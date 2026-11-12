import type { PresetName, RenderConfig } from './types.js'

export const RNG_VERSION = 1
export const SHADER_VERSION = 1

export const PRESETS: Record<PresetName, RenderConfig> = {
  preview: {
    width: 480,
    height: 270,
    frameCount: 8,
    fps: 24,
    targetSpp: 32,
    sppPerPass: 4,
    shutterFraction: 0.7,
    maxDepth: 6,
    rrStartDepth: 3,
    rrSurvival: 0.5,
    preset: 'preview',
  },
  demo: {
    width: 854,
    height: 480,
    frameCount: 40,
    fps: 24,
    targetSpp: 256,
    sppPerPass: 4,
    shutterFraction: 0.7,
    maxDepth: 6,
    rrStartDepth: 3,
    rrSurvival: 0.5,
    preset: 'demo',
  },
  final: {
    width: 854,
    height: 480,
    frameCount: 40,
    fps: 24,
    targetSpp: 512,
    sppPerPass: 4,
    shutterFraction: 0.7,
    maxDepth: 8,
    rrStartDepth: 3,
    rrSurvival: 0.5,
    preset: 'final',
  },
}

// SwiftShader 等软件渲染环境下降级，避免单帧耗时失控
export function softwareFallback(cfg: RenderConfig): RenderConfig {
  return { ...cfg, targetSpp: Math.min(cfg.targetSpp, 128), sppPerPass: 4 }
}
