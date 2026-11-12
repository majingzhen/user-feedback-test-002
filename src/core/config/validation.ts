import type { RenderConfig } from './types.js'

export function validateConfig(cfg: RenderConfig): string[] {
  const errors: string[] = []
  if (cfg.width < 2 || cfg.height < 2) errors.push('分辨率必须 >= 2')
  if (cfg.width > 4096 || cfg.height > 4096) errors.push('分辨率上限 4096')
  if (cfg.frameCount < 1) errors.push('帧数必须 >= 1')
  if (cfg.fps < 1 || cfg.fps > 120) errors.push('fps 超出合理范围')
  if (cfg.targetSpp < 1) errors.push('targetSpp 必须 >= 1')
  if (cfg.sppPerPass < 1 || cfg.sppPerPass > 16) errors.push('sppPerPass 范围 [1,16]')
  if (cfg.targetSpp % cfg.sppPerPass !== 0) errors.push('targetSpp 必须能被 sppPerPass 整除')
  if (cfg.shutterFraction < 0 || cfg.shutterFraction > 1) errors.push('shutterFraction 范围 [0,1]')
  if (cfg.maxDepth < 1 || cfg.maxDepth > 32) errors.push('maxDepth 范围 [1,32]')
  if (cfg.rrSurvival <= 0 || cfg.rrSurvival > 1) errors.push('rrSurvival 范围 (0,1]')
  return errors
}
