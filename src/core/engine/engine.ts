import type { FrameMeta, RenderConfig, SessionMeta } from '../config/types.js'
import { RNG_VERSION, SHADER_VERSION } from '../config/presets.js'
import { emptyFrames, fnvChecksum, type StorageAdapter, type StoredFrame } from '../storage/types.js'

export interface EngineRenderer {
  // 进入一帧：existing 非空时把历史累积缓冲回灌到 ping-pong 纹理
  prepareFrame(frameIndex: number, existing: StoredFrame | null): Promise<void>
  // 从 sampleBase 起追踪一个 pass（内部 sppPerPass 条），返回新的总 SPP
  runPass(frameIndex: number, sampleBase: number): Promise<number>
  readAccumulation(): Promise<Float32Array>
  renderThumbnail(): Promise<Blob>
}

export type EngineState = 'idle' | 'running' | 'paused' | 'done'

export interface EngineStatus {
  state: EngineState
  currentFrame: number | null
  frameSpp: number
  targetSpp: number
  lockedCount: number
  frames: FrameMeta[]
}

type Listener<T> = (payload: T) => void

const yieldToUi = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

export class RenderEngine {
  private state: EngineState = 'idle'
  private currentFrame: number | null = null
  private frameSpp = 0
  private frames: FrameMeta[]
  private meta: SessionMeta
  private loopToken = 0

  private progressListeners = new Set<Listener<EngineStatus>>()
  private lockedListeners = new Set<Listener<number>>()
  private doneListeners = new Set<Listener<void>>()

  constructor(
    private readonly config: RenderConfig,
    private readonly renderer: EngineRenderer,
    private readonly storage: StorageAdapter,
    configHash: string,
    rendererInfo: string,
    meta: SessionMeta | null,
  ) {
    void configHash
    void rendererInfo
    this.frames = meta?.frames ?? emptyFrames(config.frameCount)
    this.meta = meta ?? {
      configHash,
      config,
      rendererInfo,
      rngVersion: RNG_VERSION,
      shaderVersion: SHADER_VERSION,
      frames: this.frames,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  onProgress(cb: Listener<EngineStatus>): () => void {
    this.progressListeners.add(cb)
    return () => this.progressListeners.delete(cb)
  }
  onFrameLocked(cb: Listener<number>): () => void {
    this.lockedListeners.add(cb)
    return () => this.lockedListeners.delete(cb)
  }
  onDone(cb: Listener<void>): () => void {
    this.doneListeners.add(cb)
    return () => this.doneListeners.delete(cb)
  }

  status(): EngineStatus {
    return {
      state: this.state,
      currentFrame: this.currentFrame,
      frameSpp: this.frameSpp,
      targetSpp: this.config.targetSpp,
      lockedCount: this.frames.filter((f) => f.status === 'locked').length,
      frames: this.frames,
    }
  }

  getFrameMeta(frameIndex: number): FrameMeta {
    return this.frames[frameIndex]
  }

  getRenderer(): EngineRenderer {
    return this.renderer
  }

  // 导出/时间线回放：把已锁定帧的浮点缓冲回灌到渲染器，返回其 SPP
  async replayFrame(frameIndex: number): Promise<number> {
    const stored = await this.storage.loadFrame(frameIndex)
    if (!stored) throw new Error(`帧 ${frameIndex} 尚无累积缓冲，无法回放`)
    await this.renderer.prepareFrame(frameIndex, stored)
    return stored.spp
  }

  async start(): Promise<void> {
    if (this.state === 'running') return
    this.state = 'running'
    const token = ++this.loopToken
    this.emitProgress()
    await this.runLoop(token)
  }

  // stop/pause 语义相同：循环退出并冲刷当前帧的部分累积
  async stop(): Promise<void> {
    if (this.state !== 'running') return
    this.state = 'paused'
    this.loopToken++
    this.emitProgress()
  }

  private async runLoop(token: number): Promise<void> {
    while (this.state === 'running' && token === this.loopToken) {
      const frameIndex = this.frames.findIndex((f) => f.status !== 'locked')
      if (frameIndex < 0) {
        this.state = 'done'
        this.currentFrame = null
        this.frameSpp = 0
        await this.persistMeta()
        this.emitProgress()
        this.doneListeners.forEach((cb) => cb())
        return
      }

      const frame = this.frames[frameIndex]
      this.currentFrame = frameIndex
      frame.status = 'rendering'
      this.emitProgress()

      const existing = frame.spp > 0 ? await this.storage.loadFrame(frameIndex) : null
      await this.renderer.prepareFrame(frameIndex, existing)
      this.frameSpp = existing?.spp ?? 0

      while (
        this.state === 'running' &&
        token === this.loopToken &&
        this.frameSpp < this.config.targetSpp
      ) {
        this.frameSpp = await this.renderer.runPass(frameIndex, this.frameSpp)
        frame.spp = this.frameSpp
        this.emitProgress()
        await yieldToUi()
      }

      if (this.frameSpp >= this.config.targetSpp) {
        await this.lockFrame(frameIndex)
      } else {
        // 中途停止：部分累积落盘，帧保持 pending，恢复时从精确 SPP 继续
        await this.flushFrame(frameIndex)
      }
    }
  }

  private async lockFrame(frameIndex: number): Promise<void> {
    const stored = await this.collectFrame()
    await this.storage.saveFrame(frameIndex, stored)
    const thumb = await this.renderer.renderThumbnail()
    await this.storage.saveThumbnail(frameIndex, thumb)
    this.frames[frameIndex].status = 'locked'
    await this.persistMeta()
    this.lockedListeners.forEach((cb) => cb(frameIndex))
    this.emitProgress()
  }

  private async flushFrame(frameIndex: number): Promise<void> {
    if (this.frameSpp === 0) return
    const stored = await this.collectFrame()
    await this.storage.saveFrame(frameIndex, stored)
    this.frames[frameIndex].status = 'pending'
    await this.persistMeta()
  }

  private async collectFrame(): Promise<StoredFrame> {
    const buffer = await this.renderer.readAccumulation()
    return { spp: this.frameSpp, buffer, checksum: fnvChecksum(buffer) }
  }

  private async persistMeta(): Promise<void> {
    this.meta.frames = this.frames
    this.meta.updatedAt = Date.now()
    await this.storage.saveMeta(this.meta)
  }

  private emitProgress(): void {
    const snapshot = this.status()
    this.progressListeners.forEach((cb) => cb(snapshot))
  }
}
