// M0 探针：验证无头 WebGL2 + shader 编译 + 最小端到端渲染
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PRESETS } from '../src/core/config/presets.js'
import { buildDemoScene } from '../src/core/scene/demo_scene.js'
import { computeConfigHash } from '../src/core/scene/scene_hash.js'
import { launchPage } from '../src/node/browser_launcher.js'
import { installBridge, startStaticServer, type PtApi } from '../src/node/browser_bridge.js'
import { LocalServer } from '../src/node/local_server.js'
import { NodeStorageSink } from '../src/node/node_storage.js'

const cfg = { ...PRESETS.preview, frameCount: 1, targetSpp: 128, width: 480, height: 270 }
const scene = buildDemoScene()
const hash = computeConfigHash(cfg, scene)
const sessionId = hash.slice(0, 12)
const outRoot = join(process.cwd(), 'output')
const sink = new NodeStorageSink(outRoot, sessionId)
sink.width = cfg.width
sink.height = cfg.height
await mkdir(sink.sessionDir, { recursive: true })

const local = new LocalServer(sink)
await local.start()
const distRoot = join(process.cwd(), 'dist')
if (!existsSync(distRoot)) throw new Error('先执行 vite build')
const staticSrv = await startStaticServer(distRoot)

const { browser, page, renderer } = await launchPage(true)
try {
  await installBridge(page, local.baseUrl, local.token, sessionId)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.goto(staticSrv.url)
  await page.waitForFunction(
    () => typeof (globalThis as unknown as { __pt?: PtApi }).__pt?.init === 'function',
  )
  const info = await page.evaluate(
    (c) => (globalThis as unknown as { __pt: PtApi }).__pt.init(c),
    cfg,
  )
  console.log('启动参数:', renderer)
  console.log('能力报告:', JSON.stringify(info.caps, null, 2))
  await page.evaluate(() => (globalThis as unknown as { __pt: PtApi }).__pt.start())

  const t0 = Date.now()
  const deadline = Date.now() + 300000
  for (;;) {
    const s = await page.evaluate(() =>
      (globalThis as unknown as { __pt: PtApi }).__pt.status(),
    )
    process.stdout.write(`\r状态 ${s.state} 锁定 ${s.lockedCount}/${s.frames.length}`)
    if (s.state === 'done') break
    if (Date.now() > deadline) throw new Error('渲染超时')
    await new Promise((r) => setTimeout(r, 500))
  }
  process.stdout.write('\n')
  const seconds = (Date.now() - t0) / 1000
  const rays = cfg.width * cfg.height * cfg.targetSpp
  console.log(`耗时 ${seconds.toFixed(1)}s · 约 ${Math.round(rays / seconds).toLocaleString()} 主光线/秒`)
  if (errors.length) throw new Error(errors.join('\n'))
  const meta = await sink.readMeta()
  console.log('checkpoint 帧状态:', meta?.frames.map((f) => `${f.frameIndex}:${f.status}@${f.spp}`))
  console.log('会话目录:', sink.sessionDir)
} finally {
  await browser.close()
  staticSrv.server.close()
  await local.stop()
}
