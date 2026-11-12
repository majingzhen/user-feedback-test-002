import type { FrameMeta, SessionMeta } from '../config/types.js'

export interface StoredFrame {
  spp: number
  buffer: Float32Array
  checksum: number
}

// 引擎只依赖此接口；浏览器用 IDB，Node 用本地 HTTP 桥接落盘
export interface StorageAdapter {
  readonly sessionId: string
  loadMeta(): Promise<SessionMeta | null>
  saveMeta(meta: SessionMeta): Promise<void>
  loadFrame(frameIndex: number): Promise<StoredFrame | null>
  saveFrame(frameIndex: number, data: StoredFrame): Promise<void>
  saveThumbnail(frameIndex: number, blob: Blob): Promise<void>
  loadThumbnail?(frameIndex: number): Promise<Blob | null>
  listFrameIndices(): Promise<number[]>
}

// f32 缓冲校验和，写盘/读回各算一次
export function fnvChecksum(buf: Float32Array): number {
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function emptyFrames(frameCount: number): FrameMeta[] {
  return Array.from({ length: frameCount }, (_, i) => ({
    frameIndex: i,
    spp: 0,
    status: 'pending' as const,
  }))
}
