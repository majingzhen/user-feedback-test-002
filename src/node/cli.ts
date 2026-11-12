import { parseArgs } from 'node:util'
import { join } from 'node:path'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { PRESETS, softwareFallback } from '../core/config/presets.js'
import type { PresetName, RenderConfig } from '../core/config/types.js'
import { validateConfig } from '../core/config/validation.js'
import { buildDemoScene } from '../core/scene/demo_scene.js'
import { computeConfigHash } from '../core/scene/scene_hash.js'
import { launchPage } from './browser_launcher.js'
import { installBridge, startStaticServer, type PtApi } from './browser_bridge.js'
import { LocalServer } from './local_server.js'
import { NodeStorageSink } from './node_storage.js'

interface CliOptions {
  command: string
  preset: PresetName
  out: string
  frames?: number
  spp?: number
  width?: number
  height?: number
  swiftShader: boolean
  pollMs: number
}

function parseCli(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      preset: { type: 'string', default: 'preview' },
      out: { type: 'string', default: 'output' },
      frames: { type: 'string' },
      spp: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      'swift-shader': { type: 'boolean', default: false },
      'poll-ms': { type: 'string', default: '1000' },
    },
    allowPositionals: true,
  })
  return {
    command: positionals[0] ?? 'render',
    preset: (values.preset as PresetName) ?? 'preview',
    out: values.out as string,
    frames: values.frames ? Number(values.frames) : undefined,
    spp: values.spp ? Number(values.spp) : undefined,
    width: values.width ? Number(values.width) : undefined,
    height: values.height ? Number(values.height) : undefined,
    swiftShader: Boolean(values['swift-shader']),
    pollMs: Number(values['poll-ms']),
  }
}

function buildConfig(o: CliOptions): RenderConfig {
  const cfg: RenderConfig = { ...PRESETS[o.preset] }
  if (o.frames) cfg.frameCount = o.frames
  if (o.spp) cfg.targetSpp = o.spp
  if (o.width) cfg.width = o.width
  if (o.height) cfg.height = o.height
  const errors = validateConfig(cfg)
  if (errors.length) throw new Error(errors.join('；'))
  return cfg
}

async function waitDone(page: Awaited<ReturnType<typeof launchPage>>['page'], pollMs: number): Promise<void> {
  const readStatus = () =>
    page.evaluate(() => (globalThis as unknown as { __pt: PtApi }).__pt.status())
  for (;;) {
    const s = await readStatus()
    process.stdout.write(`\r状态 ${s.state} · 锁定 ${s.lockedCount}/${s.frames.length}`)
    if (s.state === 'done') {
      process.stdout.write('\n')
      return
    }
    if (s.state === 'paused' || s.state === 'idle') throw new Error('渲染意外停止')
    await new Promise((r) => setTimeout(r, pollMs))
  }
}

async function runRender(o: CliOptions): Promise<void> {
  const cfg = o.swiftShader ? softwareFallback(buildConfig(o)) : buildConfig(o)
  const scene = buildDemoScene()
  const hash = computeConfigHash(cfg, scene)
  const sessionId = hash.slice(0, 12)
  const sink = new NodeStorageSink(o.out, sessionId)
  sink.width = cfg.width
  sink.height = cfg.height
  await mkdir(sink.sessionDir, { recursive: true })

  const local = new LocalServer(sink)
  await local.start()

  const distRoot = join(process.cwd(), 'dist')
  if (!existsSync(distRoot)) throw new Error('缺少 dist/，请先执行 pnpm build')
  const staticSrv = await startStaticServer(distRoot)

  const { browser, page } = await launchPage(o.swiftShader)
  try {
    await installBridge(page, local.baseUrl, local.token, sessionId)
    await page.goto(staticSrv.url)
    await page.waitForFunction(
      () => typeof (globalThis as unknown as { __pt?: PtApi }).__pt?.init === 'function',
    )
    const result = await page.evaluate(
      (c) => (globalThis as unknown as { __pt: PtApi }).__pt.init(c),
      cfg,
    )
    console.log('\n会话', sessionId, '能力', JSON.stringify(result.caps))
    await page.evaluate(() => (globalThis as unknown as { __pt: PtApi }).__pt.start())
    await waitDone(page, o.pollMs)
    console.log('渲染完成，产物在', sink.sessionDir)
  } finally {
    await browser.close()
    staticSrv.server.close()
    await local.stop()
  }
}

async function runExport(o: CliOptions): Promise<void> {
  const sessions = await readdir(o.out, { withFileTypes: true }).then((ds) =>
    ds.filter((d) => d.isDirectory() && d.name.startsWith('session-')).map((d) => join(o.out, d.name)),
  )
  if (!sessions.length) throw new Error('没有可导出的会话')
  const dir = sessions[sessions.length - 1]
  const exportDir = join(dir, 'png')
  await mkdir(exportDir, { recursive: true })
  const metas = JSON.parse(await readFile(join(dir, 'checkpoint.json'), 'utf8')) as { frames: Array<{ frameIndex: number }> }
  let count = 0
  for (const f of metas.frames) {
    const thumb = join(dir, `thumb_${String(f.frameIndex).padStart(4, '0')}.png`)
    if (existsSync(thumb)) {
      await writeFile(join(exportDir, `frame_${String(f.frameIndex).padStart(4, '0')}.png`), await readFile(thumb))
      count++
    }
  }
  console.log(`已导出 ${count} 张 PNG 到 ${exportDir}`)
  console.log('WebM 请在浏览器 UI 中导出（无头 WebCodecs 支持因环境而异）')
}

async function main(): Promise<void> {
  const o = parseCli(process.argv.slice(2))
  // render 与 resume 等价：同 config hash 自动跳过已锁定帧、从断点 SPP 继续
  if (o.command === 'export') {
    await runExport(o)
    return
  }
  if (o.command !== 'render' && o.command !== 'resume') {
    throw new Error(`未知命令 ${o.command}，支持：render / resume / export`)
  }
  await runRender(o)
}

main().catch((err: Error) => {
  console.error('\n失败：', err.message)
  process.exit(1)
})
