import { PRESETS, softwareFallback } from '../core/config/presets.js'
import type { PresetName, RenderConfig, SessionMeta } from '../core/config/types.js'
import { validateConfig } from '../core/config/validation.js'
import { RenderEngine, type EngineStatus } from '../core/engine/engine.js'
import { buildDemoScene } from '../core/scene/demo_scene.js'
import { computeConfigHash } from '../core/scene/scene_hash.js'
import { probeEncoders, type CodecSupport } from '../encode/codec_probe.js'
import type { StorageAdapter } from '../core/storage/types.js'
import { GlRenderer } from '../gl/renderer.js'
import { createGlContext, glProbe } from '../gl/context.js'
import { IdbAdapter } from '../storage/idb_adapter.js'
import { NodeBridgeAdapter } from '../storage/node_bridge_adapter.js'
import { Timeline } from './timeline.js'
import { exportPngSequence, exportVideo } from './export_dialog.js'

interface BridgeConfig {
  baseUrl: string
  token: string
  sessionId: string
}

function readBridge(): BridgeConfig | null {
  return (window as unknown as { __ptBridge?: BridgeConfig }).__ptBridge ?? null
}

interface PtApi {
  init(config: Partial<RenderConfig>): Promise<{ sessionId: string; caps: unknown }>
  start(): Promise<void>
  stop(): Promise<void>
  status(): EngineStatus
  getCaps(): unknown
  exportPng(): Promise<number>
  exportVideoBlob(): Promise<boolean>
}

const els = {
  canvas: document.querySelector<HTMLCanvasElement>('#canvas')!,
  badge: document.querySelector<HTMLElement>('#renderer-badge')!,
  hint: document.querySelector<HTMLElement>('#visibility-hint')!,
  empty: document.querySelector<HTMLElement>('#empty-hint')!,
  preset: document.querySelector<HTMLSelectElement>('#preset')!,
  frameCount: document.querySelector<HTMLInputElement>('#frame-count')!,
  targetSpp: document.querySelector<HTMLInputElement>('#target-spp')!,
  width: document.querySelector<HTMLInputElement>('#width')!,
  height: document.querySelector<HTMLInputElement>('#height')!,
  shutter: document.querySelector<HTMLInputElement>('#shutter')!,
  shutterVal: document.querySelector<HTMLElement>('#shutter-val')!,
  start: document.querySelector<HTMLButtonElement>('#btn-start')!,
  stop: document.querySelector<HTMLButtonElement>('#btn-stop')!,
  png: document.querySelector<HTMLButtonElement>('#btn-png')!,
  video: document.querySelector<HTMLButtonElement>('#btn-video')!,
  error: document.querySelector<HTMLElement>('#error-text')!,
  progress: document.querySelector<HTMLElement>('#progress-text')!,
  exportStatus: document.querySelector<HTMLElement>('#export-status')!,
  timeline: document.querySelector<HTMLElement>('#timeline')!,
}

class Studio {
  private engine: RenderEngine | null = null
  private renderer: GlRenderer | null = null
  private storage: StorageAdapter | null = null
  private config: RenderConfig | null = null
  private configHash = ''
  private caps: ReturnType<typeof glProbe> | null = null
  private codec: CodecSupport | null = null
  private thumbs = new Map<number, string>()
  private timeline = new Timeline(els.timeline)

  async init(overrides: Partial<RenderConfig> = {}): Promise<{ sessionId: string; caps: unknown }> {
    const presetName = (overrides.preset ?? (els.preset.value as PresetName))
    const base: RenderConfig = { ...PRESETS[presetName], ...overrides }
    if (!overrides.preset) {
      base.frameCount = Number(els.frameCount.value)
      base.targetSpp = Number(els.targetSpp.value)
      base.width = Number(els.width.value)
      base.height = Number(els.height.value)
      base.shutterFraction = Number(els.shutter.value)
    }
    const errors = validateConfig(base)
    if (errors.length) throw new Error(errors.join('；'))
    this.config = base

    const gl = createGlContext(els.canvas)
    this.caps = glProbe(gl)
    if (this.caps.isSoftware && !overrides.preset) {
      this.config = softwareFallback(base)
    }
    const cfg = this.config
    els.canvas.width = cfg.width
    els.canvas.height = cfg.height
    els.badge.textContent = this.caps.isSoftware
      ? `软件渲染 · ${this.caps.renderer}（已自动降级 SPP）`
      : this.caps.renderer
    this.codec = await probeEncoders(cfg.width, cfg.height, cfg.fps)

    const scene = buildDemoScene()
    this.configHash = computeConfigHash(cfg, scene)
    const bridge = readBridge()
    const sessionId = this.configHash.slice(0, 12)
    this.storage = bridge
      ? new NodeBridgeAdapter(sessionId, bridge.baseUrl, bridge.token)
      : new IdbAdapter(sessionId)
    const meta: SessionMeta | null = await this.storage.loadMeta()
    this.renderer = new GlRenderer(gl, scene, cfg, this.configHash)
    this.engine = new RenderEngine(cfg, this.renderer, this.storage, this.configHash, this.caps.renderer, meta)
    this.wireEngine()
    await this.restoreThumbs(meta)
    this.timeline.render(this.engine.status(), this.thumbs, (i) => void this.replay(i))
    els.empty.hidden = true
    return { sessionId, caps: this.caps }
  }

  private wireEngine(): void {
    const engine = this.engine!
    engine.onProgress((status) => {
      this.timeline.render(status, this.thumbs, (i) => void this.replay(i))
      const cur = status.currentFrame
      const sppText = cur === null ? '' : ` · 帧 ${cur} SPP ${status.frameSpp}`
      els.progress.textContent = `已锁定 ${status.lockedCount}/${status.frames.length}${sppText}`
      if (this.renderer && cur !== null) this.renderer.showPreview(status.frameSpp)
      const running = status.state === 'running'
      els.start.disabled = running
      els.stop.disabled = !running
      els.png.disabled = status.lockedCount === 0
      els.video.disabled = status.lockedCount === 0 || this.codec === null
      els.video.title = this.codec === null ? '当前环境无可用 WebCodecs 编码器，仅支持 PNG' : ''
    })
    engine.onFrameLocked((i) => void this.cacheThumb(i))
  }

  private async cacheThumb(i: number): Promise<void> {
    const blob = (await this.storage!.loadThumbnail?.(i)) ?? null
    if (!blob) return
    const old = this.thumbs.get(i)
    if (old) URL.revokeObjectURL(old)
    this.thumbs.set(i, URL.createObjectURL(blob))
  }

  private async restoreThumbs(meta: SessionMeta | null): Promise<void> {
    if (!meta || !this.storage) return
    for (const f of meta.frames) {
      if (f.status === 'locked') await this.cacheThumb(f.frameIndex)
    }
  }

  private async replay(i: number): Promise<void> {
    if (!this.engine || this.engine.getFrameMeta(i).status !== 'locked') return
    const spp = await this.engine.replayFrame(i)
    this.renderer!.showPreview(spp)
  }

  async start(): Promise<void> {
    if (!this.engine) await this.init()
    await this.engine!.start()
  }

  async stop(): Promise<void> {
    await this.engine?.stop()
  }

  status(): EngineStatus {
    if (!this.engine) throw new Error('尚未初始化')
    return this.engine.status()
  }

  getCaps(): unknown {
    return { gl: this.caps, codec: this.codec }
  }

  async exportPng(): Promise<number> {
    if (!this.engine || !this.config) throw new Error('尚未初始化')
    return exportPngSequence(this.engine, els.canvas, this.config.frameCount, (m) => {
      els.exportStatus.textContent = m
    })
  }

  async exportVideoBlob(): Promise<boolean> {
    if (!this.engine || !this.config || !this.codec) return false
    await exportVideo(
      this.engine,
      els.canvas,
      this.codec,
      this.config.frameCount,
      this.config.fps,
      (m) => {
        els.exportStatus.textContent = m
      },
    )
    return true
  }
}

const studio = new Studio()
const api: PtApi = {
  init: (c) => studio.init(c),
  start: () => studio.start(),
  stop: () => studio.stop(),
  status: () => studio.status(),
  getCaps: () => studio.getCaps(),
  exportPng: () => studio.exportPng(),
  exportVideoBlob: () => studio.exportVideoBlob(),
}
;(window as unknown as { __pt: PtApi }).__pt = api

els.preset.addEventListener('change', () => {
  const p = PRESETS[els.preset.value as PresetName]
  els.frameCount.value = String(p.frameCount)
  els.targetSpp.value = String(p.targetSpp)
  els.width.value = String(p.width)
  els.height.value = String(p.height)
  els.shutter.value = String(p.shutterFraction)
  els.shutterVal.textContent = p.shutterFraction.toFixed(2)
})
els.shutter.addEventListener('input', () => {
  els.shutterVal.textContent = Number(els.shutter.value).toFixed(2)
})
els.start.addEventListener('click', () => {
  studio
    .start()
    .catch((err: Error) => {
      els.error.hidden = false
      els.error.textContent = err.message
    })
})
els.stop.addEventListener('click', () => void studio.stop())
els.png.addEventListener('click', () =>
  studio.exportPng().catch((err: Error) => (els.exportStatus.textContent = err.message)),
)
els.video.addEventListener('click', () =>
  studio.exportVideoBlob().catch((err: Error) => (els.exportStatus.textContent = err.message)),
)
document.addEventListener('visibilitychange', () => {
  els.hint.hidden = !document.hidden
})
