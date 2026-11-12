// 播种策略的唯一来源。GLSL 侧 shaders/chunks/rng.ts 必须保持同一公式。
// 续算不变量：(pixelIndex, frameIndex, globalSampleIndex, configHash) 相同则种子相同，
// globalSampleIndex 单调递增，因此恢复后采样流严格衔接、不重复。

function mix32(input: number): number {
  let h = input >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

export function makeSeed(
  pixelIndex: number,
  frameIndex: number,
  globalSampleIndex: number,
  configHash: number,
): number {
  let h = mix32(pixelIndex)
  h = mix32(h ^ (frameIndex >>> 0))
  h = mix32(h ^ (globalSampleIndex >>> 0))
  h = mix32(h ^ (configHash >>> 0))
  return h >>> 0
}
