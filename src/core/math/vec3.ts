export type Vec3 = [number, number, number]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const lengthSq = (a: Vec3): number => dot(a, a)
export const length = (a: Vec3): number => Math.sqrt(lengthSq(a))
export const normalize = (a: Vec3): Vec3 => {
  const len = length(a)
  return len > 1e-12 ? scale(a, 1 / len) : [0, 0, 0]
}
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
export const mul = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]]

export const reflect = (v: Vec3, n: Vec3): Vec3 => {
  const d = 2 * dot(v, n)
  return [v[0] - d * n[0], v[1] - d * n[1], v[2] - d * n[2]]
}

// 入射 v 指向表面，n 为朝向入射方的法线；etai/etat 为两侧 IOR
export function refract(v: Vec3, n: Vec3, etaiOverEtat: number): Vec3 | null {
  const cosTheta = Math.min(-dot(v, n), 1)
  const sinSq = 1 - cosTheta * cosTheta
  const k = 1 - etaiOverEtat * etaiOverEtat * sinSq
  if (k <= 0) return null
  const c = etaiOverEtat * cosTheta - Math.sqrt(k)
  return [
    etaiOverEtat * v[0] + c * n[0],
    etaiOverEtat * v[1] + c * n[1],
    etaiOverEtat * v[2] + c * n[2],
  ]
}

export const schlick = (cosine: number, iorRatio: number): number => {
  let r0 = (1 - iorRatio) / (1 + iorRatio)
  r0 *= r0
  return r0 + (1 - r0) * Math.pow(1 - cosine, 5)
}
