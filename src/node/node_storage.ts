import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decodePtf, encodePtf } from './ptf1.js'
import { fnvChecksum, type StoredFrame } from '../core/storage/types.js'
import type { SessionMeta } from '../core/config/types.js'

// Node 落盘端：f32 走 PTF1（宽高头由服务端按 session 尺寸补齐），checkpoint 原子写
export class NodeStorageSink {
  readonly sessionDir: string
  width = 0
  height = 0

  constructor(outRoot: string, readonly sessionId: string) {
    this.sessionDir = join(outRoot, `session-${sessionId}`)
  }

  private framePath(i: number): string {
    return join(this.sessionDir, `frame_${String(i).padStart(4, '0')}.ptf1`)
  }

  async put(key: string, data: Buffer): Promise<void> {
    await mkdir(this.sessionDir, { recursive: true })
    if (key.startsWith('frame/')) {
      const i = Number(key.slice('frame/'.length))
      const view = new DataView(data.buffer, data.byteOffset, 8)
      const spp = view.getUint32(0, true)
      const floats = new Float32Array(data.buffer, data.byteOffset + 8, data.length / 4 - 2)
      await writeFile(this.framePath(i), encodePtf(this.width, this.height, spp, floats))
      return
    }
    if (key === 'meta') {
      const tmp = join(this.sessionDir, 'checkpoint.json.tmp')
      await writeFile(tmp, data)
      await rename(tmp, join(this.sessionDir, 'checkpoint.json'))
      return
    }
    if (key.startsWith('thumb/')) {
      const i = Number(key.slice('thumb/'.length))
      await writeFile(join(this.sessionDir, `thumb_${String(i).padStart(4, '0')}.png`), data)
    }
  }

  async readFrame(i: number): Promise<StoredFrame | null> {
    try {
      const data = await readFile(this.framePath(i))
      const { buffer, spp } = decodePtf(data)
      return { spp, buffer, checksum: fnvChecksum(buffer) }
    } catch {
      return null
    }
  }

  async readMeta(): Promise<SessionMeta | null> {
    try {
      const text = await readFile(join(this.sessionDir, 'checkpoint.json'), 'utf8')
      return JSON.parse(text) as SessionMeta
    } catch {
      return null
    }
  }
}
