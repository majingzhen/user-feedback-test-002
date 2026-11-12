import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import type { NodeStorageSink } from './node_storage.js'

// 只监听 127.0.0.1：PUT /put/* 回传数据，GET /get/* 读取续算状态
export class LocalServer {
  private server: Server | null = null
  private port = 0
  readonly token = randomBytes(12).toString('hex')

  constructor(private readonly sink: NodeStorageSink) {}

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => void this.handle(req, res))
      this.server.on('error', reject)
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address()
        if (addr && typeof addr === 'object') {
          this.port = addr.port
          resolve(this.port)
        } else {
          reject(new Error('无法获取本地服务端口'))
        }
      })
    })
  }

  private readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c as Buffer))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'x-pt-token, content-type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }
    try {
      if (req.headers['x-pt-token'] !== this.token) {
        res.writeHead(403).end()
        return
      }
      const url = req.url ?? ''
      if (req.method === 'PUT' && url.startsWith('/put/')) {
        const key = decodeURIComponent(url.slice('/put/'.length))
        await this.sink.put(key, await this.readBody(req))
        res.writeHead(204).end()
        return
      }
      if (req.method === 'GET' && url.startsWith('/get/')) {
        const key = decodeURIComponent(url.slice('/get/'.length))
        if (key === 'meta') {
          const meta = await this.sink.readMeta()
          if (!meta) {
            res.writeHead(404).end()
            return
          }
          res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(meta))
          return
        }
        if (key.startsWith('frame/')) {
          const i = Number(key.slice('frame/'.length))
          const stored = await this.sink.readFrame(i)
          if (!stored) {
            res.writeHead(404).end()
            return
          }
          // 转回桥接负载：u32 spp + u32 checksum + float 体
          const floats = Buffer.from(stored.buffer.buffer, stored.buffer.byteOffset, stored.buffer.byteLength)
          const header = Buffer.alloc(8)
          header.writeUInt32LE(stored.spp, 0)
          header.writeUInt32LE(stored.checksum, 4)
          res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(Buffer.concat([header, floats]))
          return
        }
      }
      res.writeHead(404).end()
    } catch (err) {
      res.writeHead(500, String(err)).end()
    }
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server?.close(() => resolve()))
  }
}
