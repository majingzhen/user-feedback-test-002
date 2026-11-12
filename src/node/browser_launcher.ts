import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const COMMON_ARGS = [
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  '--enable-webgl',
  '--window-size=1000,720',
]

// 优先用本机已装的完整 Chromium（带 WebGL/WebCodecs），避免要求新装 headless shell
function resolveExecutable(): string | undefined {
  const root = process.env.LOCALAPPDATA ?? ''
  const base = join(root, 'ms-playwright')
  if (!existsSync(base)) return undefined
  const candidates = ['chromium-1234', 'chromium-1223']
  for (const dir of candidates) {
    const exe = join(base, dir, 'chrome-win64', 'chrome.exe')
    if (existsSync(exe)) return exe
  }
  return undefined
}

// 先试硬件 ANGLE，失败回退 SwiftShader
export async function launchPage(
  forceSwiftShader: boolean,
): Promise<{ browser: Browser; page: Page; renderer: string }> {
  const executablePath = resolveExecutable()
  const attempts = forceSwiftShader
    ? [['--use-angle=swiftshader', '--use-gl=angle']]
    : [
        ['--use-angle=default'],
        ['--use-angle=d3d11', '--use-gl=angle'],
        ['--use-angle=swiftshader', '--use-gl=angle'],
      ]

  let lastError: unknown = null
  for (const args of attempts) {
    try {
      const browser = await chromium.launch({
        headless: true,
        executablePath,
        args: [...COMMON_ARGS, ...args],
      })
      const page = await browser.newPage({ viewport: { width: 960, height: 680 } })
      page.on('pageerror', (err) => console.error('[page-error]', err.message))
      page.on('console', (msg) => {
        const text = msg.text()
        // 首次加载无 meta/缩略图的 404 是正常探测，不打印
        if (msg.type() === 'error' && !text.includes('404')) console.error('[console]', text)
      })
      return { browser, page, renderer: args.join(' ') }
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`所有 GL 启动路径均失败：${String(lastError)}`)
}
