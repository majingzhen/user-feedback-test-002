import type { Scene } from '../scene/types.js'

export type PresetName = 'preview' | 'demo' | 'final'

export interface RenderConfig {
  width: number
  height: number
  frameCount: number
  fps: number
  // 目标 SPP 不纳入 config hash，提高它是合法续算
  targetSpp: number
  // 每个绘制 pass 内追踪的 sample 数，纳入 hash
  sppPerPass: number
  // 快门占帧间隔比例 [0,1]
  shutterFraction: number
  maxDepth: number
  rrStartDepth: number
  rrSurvival: number
  preset: PresetName
}

export interface SessionMeta {
  configHash: string
  config: RenderConfig
  rendererInfo: string
  rngVersion: number
  shaderVersion: number
  frames: FrameMeta[]
  createdAt: number
  updatedAt: number
}

export interface FrameMeta {
  frameIndex: number
  spp: number
  status: 'pending' | 'rendering' | 'locked'
}

export interface SessionContext {
  scene: Scene
  config: RenderConfig
}
