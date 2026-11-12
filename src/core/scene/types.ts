import type { Vec3 } from '../math/vec3.js'

export type { Vec3 }

export type MaterialKind = 'lambertian' | 'metal' | 'dielectric'

export interface Material {
  kind: MaterialKind
  albedo: Vec3
  // metal 粗糙度 [0,1]；dielectric 不用
  roughness?: number
  // dielectric 折射率与 Beer-Lambert 透射色（每单位距离）
  ior?: number
  attenuation?: Vec3
}

// 解析式运动，任意时间点可直接求值（无关键帧）
export type Motion =
  | { kind: 'static' }
  // 匀速直线：center = base + velocity * time
  | { kind: 'linear'; velocity: Vec3 }
  // 水平圆周：center = (center.x + radius*cos(omega*t+phase), baseY, center.z + radius*sin(...))
  | { kind: 'orbit'; radius: number; omega: number; phase: number; baseY: number }

export type PrimitiveKind = 'sphere' | 'plane'

export interface Primitive {
  kind: PrimitiveKind
  // sphere: 基准中心；plane: 中心点（y 决定平面高度，法向固定 +Y）
  center: Vec3
  radius: number
  material: Material
  motion: Motion
}

export interface SkyParams {
  zenith: Vec3
  horizon: Vec3
  intensity: number
  // 环境高光 lobe：方向与锐度、强度
  lobeDirection: Vec3
  lobePower: number
  lobeIntensity: number
}

export interface Scene {
  primitives: Primitive[]
  sky: SkyParams
}
