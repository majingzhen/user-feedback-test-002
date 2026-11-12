import { RNG_VERSION, SHADER_VERSION } from '../config/presets.js'
import type { RenderConfig } from '../config/types.js'
import type { Scene } from './types.js'

// FNV-1a 32 位，零依赖；同输入必然同 hash
export function fnv1aHex(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export const hashToU32 = (hex: string): number => parseInt(hex, 16) >>> 0

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

// targetSpp 不纳入（提高 SPP 是合法续算）；preset 名只是 UI 标签，也不纳入
export function computeConfigHash(config: RenderConfig, scene: Scene): string {
  const { targetSpp: _ignoredSpp, preset: _ignoredPreset, ...hashConfig } = config
  const canonical = JSON.stringify(
    sortKeys({
      config: hashConfig,
      scene,
      versions: { rng: RNG_VERSION, shader: SHADER_VERSION },
    }),
  )
  return fnv1aHex(canonical)
}
