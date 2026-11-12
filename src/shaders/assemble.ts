import type { RenderConfig } from '../core/config/types.js'

export const MAX_PRIMITIVES = 32

// define 名与 tracer 内引用一致；这些值都纳入 config hash
export function buildShaderDefines(config: RenderConfig): Record<string, number> {
  return {
    MAX_PRIMITIVES,
    MAX_DEPTH: config.maxDepth,
    SPP_PER_PASS: config.sppPerPass,
    RR_START_DEPTH: config.rrStartDepth,
    RR_SURVIVAL: config.rrSurvival,
  }
}
