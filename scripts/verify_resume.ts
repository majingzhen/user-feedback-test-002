// 断点续算合同：同 config 下「一次渲 64SPP」与「32SPP 落盘后 resume 到 64」逐通道按位相等
import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PRESETS } from '../src/core/config/presets.js'
import { buildDemoScene } from '../src/core/scene/demo_scene.js'
import { computeConfigHash } from '../src/core/scene/scene_hash.js'
import { launchPage } from '../src/node/browser_launcher.js'
import { installBridge, startStaticServer, type PtApi } from '../src/node/browser_bridge.js'
import { LocalServer } from '../src/node/local_server.js'
import { NodeStorageSink } from '../src/node/node_storage.js'
import { decodePtf } from '../src/node/ptf1.js'
import { readFile } from 'node:fs/promises'

interface RunOpts {
  targetSpp: number
  outDir: string
  stopAt?: number
}

async function runSession(opts: RunOpts): Promise<NodeStorageSink> {
  const cfg = { ...PRESETS.preview, frameCount: 1, targetSpp: opts.targetSpp, width: 96, height: 54 }
  const scene = buildDemoScene()
  const hash = computeConfigHash(cfg, scene)
  const sessionId = hash.slice(0, 12)
  const sink = new NodeStorageSink(opts.outDir, sessionId)
  sink.width = cfg.width
  sink.height = cfg.height
  await mkdir(sink.sessionDir, { recursive: true })
  const local = new LocalServer(sink)
  await local.start()
  const staticSrv = await startStaticServer(join(process.cwd(), 'dist'))
  const { browser, page } = await launchPage(true)
  try {
    await installBridge(page, local.baseUrl, local.token, sessionId)
    await page.goto(staticSrv.url)
    await page.waitForFunction(
      () => typeof (globalThis as unknown as { __pt?: PtApi }).__pt?.init === 'function',
    )
    await page.evaluate((c) => (globalThis as unknown as { __pt: PtApi }).__pt.init(c), cfg)
    await page.evaluate(() => (globalThis as unknown as { __pt: PtApi }).__pt.start())

    if (opts.stopAt) {
      // 模拟中途停止：到达指定 SPP 后 stop，让部分累积冲刷落盘
      for (;;) {
        const s = await page.evaluate(() => (globalThis as unknown as { __pt: PtApi }).__pt.status())
        if (s.frames[0]?.spp >= opts.stopAt) {
          await page.evaluate(() => (globalThis as unknown as { __pt: PtApi }).__pt.stop())
          break
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      await new Promise((r) => setTimeout(r, 400))
    }
    for (;;) {
      const s = await page.evaluate(() => (globalThis as unknown as { __pt: PtApi }).__pt.status())
      if (s.state === 'done') break
      if (!opts.stopAt && s.state === 'paused') throw new Error('非预期暂停')
      await new Promise((r) => setTimeout(r, 200))
    }
    return sink
  } finally {
    await browser.close()
    staticSrv.server.close()
    await local.stop()
  }
}

const root = join(process.cwd(), 'output', 'resume-test')
await rm(root, { recursive: true, force: true })

// A：一次渲染 64 SPP
const sinkA = await runSession({ targetSpp: 64, outDir: join(root, 'A') })
// B：先渲到 32 SPP 停止落盘
await runSession({ targetSpp: 64, outDir: join(root, 'B'), stopAt: 32 })
// B 续算：同 config 再跑，应从 32 续到 64
const sinkB = await runSession({ targetSpp: 64, outDir: join(root, 'B') })

const fileA = join(sinkA.sessionDir, 'frame_0000.ptf1')
const fileB = join(sinkB.sessionDir, 'frame_0000.ptf1')
if (!existsSync(fileA) || !existsSync(fileB)) throw new Error('PTF 文件缺失')
const a = decodePtf(await readFile(fileA))
const b = decodePtf(await readFile(fileB))

let mismatches = 0
let maxDelta = 0
for (let i = 0; i < a.buffer.length; i++) {
  const d = Math.abs(a.buffer[i] - b.buffer[i])
  if (d > 0) mismatches++
  if (d > maxDelta) maxDelta = d
}
console.log(`A SPP=${a.spp} B SPP=${b.spp} 缓冲长度=${a.buffer.length}`)
console.log(`不一致元素 ${mismatches}/${a.buffer.length} · 最大绝对差 ${maxDelta}`)
if (a.spp !== 64 || b.spp !== 64) throw new Error('SPP 未达标')
if (mismatches !== 0) throw new Error('续算结果与一次性渲染不按位相等，RNG 不变量被破坏')
console.log('PASS：断点续算与一次性渲染逐通道按位相等')
