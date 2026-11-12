import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import type { Server } from 'node:http'
import { createServer } from 'node:http'
import type { Page } from 'playwright'
import type { RenderConfig } from '../core/config/types.js'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

// 托管 vite build 产物 dist/
export function startStaticServer(root: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const pathname = (req.url ?? '/').split('?')[0]
      const target = pathname === '/' ? '/index.html' : pathname
      const file = normalize(join(root, target))
      if (!file.startsWith(root) || !existsSync(file) || extname(file) === '') {
        res.writeHead(404).end('not found')
        return
      }
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      createReadStream(file).pipe(res)
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve({ server, url: `http://127.0.0.1:${addr.port}/` })
      else reject(new Error('静态服务端口获取失败'))
    })
  })
}

export interface PtApi {
  init(config: Partial<RenderConfig>): Promise<{ sessionId: string; caps: unknown }>
  start(): Promise<void>
  stop(): Promise<void>
  status(): {
    state: string
    lockedCount: number
    frames: Array<{ frameIndex: number; spp: number; status: string }>
  }
  getCaps(): unknown
  exportPng(): Promise<number>
  exportVideoBlob(): Promise<boolean>
}

// 页面脚本加载前注入桥接参数，src/ui/main.ts 据此切换到 NodeBridgeAdapter
export async function installBridge(
  page: Page,
  baseUrl: string,
  token: string,
  sessionId: string,
): Promise<void> {
  await page.addInitScript(
    ({ baseUrl, token, sessionId }) => {
      ;(globalThis as Record<string, unknown>).__ptBridge = { baseUrl, token, sessionId }
    },
    { baseUrl, token, sessionId },
  )
}

