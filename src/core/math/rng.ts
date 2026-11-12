// PCG32 参考实现，必须与 shaders/chunks/rng.ts 中的 GLSL 版本逐位一致

export interface PcgState {
  state: number
  inc: number
}

export function pcgInit(seed: number, seq: number): PcgState {
  const s: PcgState = { state: 0, inc: ((Math.imul(seq, 2) >>> 0) | 1) >>> 0 }
  pcgNext(s)
  s.state = (s.state + (seed >>> 0)) >>> 0
  pcgNext(s)
  return s
}

export function pcgNext(s: PcgState): number {
  const old = s.state >>> 0
  s.state = (Math.imul(old, 747796405) + s.inc) >>> 0
  const xorshifted = (((old >>> 18) ^ old) >>> 27) >>> 0
  const rot = old >>> 29
  return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0
}

// 取高 24 位再除以 2^24：2^24 以内整数 f32 精确，除 2 的幂仅改指数，
// 因此 TS(f64) 与 GLSL(f32) 结果天然逐位相等
export const pcgFloat = (s: PcgState): number => (pcgNext(s) >>> 8) / 16777216

export const pcgFloat2 = (s: PcgState): [number, number] => [pcgFloat(s), pcgFloat(s)]
