import type { SessionMeta } from '../core/config/types.js'
import type { StorageAdapter, StoredFrame } from '../core/storage/types.js'

interface FrameRecord {
  spp: number
  buffer: ArrayBuffer
  checksum: number
}

const DB_VERSION = 1

// 每帧一条 record，避免单条超大记录；db 名含 configHash，hash 不同即新会话互不覆盖
export class IdbAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase>

  constructor(readonly sessionId: string) {
    this.dbPromise = this.open()
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(`pt-session-${this.sessionId}`, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
        if (!db.objectStoreNames.contains('frames')) db.createObjectStore('frames')
        if (!db.objectStoreNames.contains('thumbs')) db.createObjectStore('thumbs')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  private async tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.dbPromise
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode)
      const req = fn(t.objectStore(store))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  }

  async ensurePersisted(): Promise<{ persisted: boolean; quota: number; usage: number }> {
    if (!navigator.storage) return { persisted: false, quota: 0, usage: 0 }
    const persisted = await navigator.storage.persist()
    const est = await navigator.storage.estimate()
    return { persisted, quota: est.quota ?? 0, usage: est.usage ?? 0 }
  }

  async loadMeta(): Promise<SessionMeta | null> {
    return this.tx<SessionMeta | undefined>('meta', 'readonly', (s) => s.get('session')).then(
      (m) => m ?? null,
    )
  }

  async saveMeta(meta: SessionMeta): Promise<void> {
    await this.tx('meta', 'readwrite', (s) => s.put(meta, 'session'))
  }

  async loadFrame(frameIndex: number): Promise<StoredFrame | null> {
    const rec = await this.tx<FrameRecord | undefined>('frames', 'readonly', (s) =>
      s.get(frameIndex),
    )
    if (!rec) return null
    return { spp: rec.spp, buffer: new Float32Array(rec.buffer), checksum: rec.checksum }
  }

  async saveFrame(frameIndex: number, data: StoredFrame): Promise<void> {
    // 拷贝为独立 ArrayBuffer，避免结构化克隆带上外部 buffer 偏移
    const buffer = data.buffer.slice().buffer
    const rec: FrameRecord = { spp: data.spp, buffer, checksum: data.checksum }
    await this.tx('frames', 'readwrite', (s) => s.put(rec, frameIndex))
  }

  async saveThumbnail(frameIndex: number, blob: Blob): Promise<void> {
    await this.tx('thumbs', 'readwrite', (s) => s.put(blob, frameIndex))
  }

  async loadThumbnail(frameIndex: number): Promise<Blob | null> {
    return this.tx<Blob | undefined>('thumbs', 'readonly', (s) => s.get(frameIndex)).then(
      (b) => b ?? null,
    )
  }

  async listFrameIndices(): Promise<number[]> {
    const keys = await this.tx<IDBValidKey[]>('frames', 'readonly', (s) => s.getAllKeys())
    return keys.map(Number).sort((a, b) => a - b)
  }
}
