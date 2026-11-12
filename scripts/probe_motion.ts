// 运动模糊验证：渲染连续多帧，输出每帧缩略图，检查相机+物体运动
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

const cfg = { ...PRESETS.preview, frameCount: 6, targetSpp: 128, width: 480, height: 270 }
const scene = buildDemoScene()
const hash = computeConfigHash(cfg, scene)
const sessionId = hash.slice(0, 12)
const sink = new NodeStorageSink(join(process.cwd(), 'output'), sessionId)
sink.width = cfg.width
sink.height = cfg.height
await mkdir(sink.sessionDir, { recursive: true })

const local = new LocalServer(sink)
await local.start()
const staticSrv = await startStaticServer(join(process.cwd(), 'dist'))
if (!existsSync('dist')) throw new Error('先 vite build')

const { browser, page } = await launchPage(true)
try {
  await installBridge(page, local.baseUrl, local.token, sessionId)
  await page.goto(staticSrv.url)
  await page.waitForFunction(
    () => typeof (globalThis as unknown as { __pt?: PtApi }).__pt?.init === 'function',
  )
  await page.evaluate((c) => (globalThis as unknown as { __pt: PtApi }).__pt.init(c), cfg)
  await page.evaluate(() => (globalThis as unknown as { __pt: PtApi }).__pt.start())
  for (;;) {
    const s = await page.evaluate(() => (globalThis as unknown as { __pt: PtApi }).__pt.status())
    process.stdout.write(`\r锁定 ${s.lockedCount}/${s.frames.length}`)
    if (s.state === 'done') break
    await new Promise((r) => setTimeout(r, 500))
  }
  process.stdout.write('\n')
  const meta = await sink.readMeta()
  console.log('帧 SPP:', meta?.frames.map((f) => f.spp).join(', '))
  console.log('会话:', sink.sessionDir)
} finally {
  await browser.close()
  staticSrv.server.close()
  await local.stop()
}
