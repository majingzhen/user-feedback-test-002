import type { StorageAdapter, StoredFrame } from '../core/storage/types.js'
import type { SessionMeta } from '../core/config/types.js'

// 运行在浏览器页面内：全部存储经 127.0.0.1 HTTP 回传/读取，零 Node API
export class NodeBridgeAdapter implements StorageAdapter {
  constructor(
    readonly sessionId: string,
    private baseUrl: string,
    private token: string,
  ) {}

  private async put(key: string, body: ArrayBuffer | Blob | string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/put/${key}`, {
      method: 'PUT',
      headers: { 'x-pt-token': this.token },
      body,
    })
    if (!res.ok) throw new Error(`桥接写入失败 ${key}: ${res.status}`)
  }

  private async getJson<T>(key: string): Promise<T | null> {
    const res = await fetch(`${this.baseUrl}/get/${key}`, {
      headers: { 'x-pt-token': this.token },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`桥接读取失败 ${key}: ${res.status}`)
    return (await res.json()) as T
  }

  async loadMeta(): Promise<SessionMeta | null> {
    return this.getJson<SessionMeta>('meta')
  }

  async saveMeta(meta: SessionMeta): Promise<void> {
    await this.put('meta', JSON.stringify(meta))
  }

  async loadFrame(frameIndex: number): Promise<StoredFrame | null> {
    const res = await fetch(`${this.baseUrl}/get/frame/${frameIndex}`, {
      headers: { 'x-pt-token': this.token },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`帧 ${frameIndex} 读取失败`)
    return decodeFramePayload(await res.arrayBuffer())
  }

  async saveFrame(frameIndex: number, data: StoredFrame): Promise<void> {
    // 8 字节头（u32 spp + u32 checksum）后接 RGBA float32 体，PTF 宽高头由服务端补
    const floats = new Uint8Array(data.buffer.buffer, data.buffer.byteOffset, data.buffer.byteLength)
    const payload = new Uint8Array(8 + floats.byteLength)
    new DataView(payload.buffer).setUint32(0, data.spp, true)
    new DataView(payload.buffer).setUint32(4, data.checksum, true)
    payload.set(floats, 8)
    await this.put(`frame/${frameIndex}`, payload)
  }

  async saveThumbnail(frameIndex: number, blob: Blob): Promise<void> {
    await this.put(`thumb/${frameIndex}`, blob)
  }

  // 缩略图只服务浏览器时间线，CLI 下直接返回 null
  async loadThumbnail(): Promise<Blob | null> {
    return null
  }

  async listFrameIndices(): Promise<number[]> {
    const meta = await this.loadMeta()
    return meta ? meta.frames.filter((f) => f.status === 'locked').map((f) => f.frameIndex) : []
  }
}

function decodeFramePayload(buf: ArrayBuffer): StoredFrame {
  const spp = new DataView(buf).getUint32(0, true)
  const checksum = new DataView(buf).getUint32(4, true)
  const bytes = new Uint8Array(buf, 8)
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return { spp, checksum, buffer: new Float32Array(copy.buffer) }
}
