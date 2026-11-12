import type { Primitive, Scene, Vec3 } from './types.js'
// 演示场景：三材质 + 双运动模糊，参数见计划文件
export function buildDemoScene(): Scene {
  const ground: Primitive = {
    kind: 'plane',
    center: [0, 0, 0],
    radius: 0,
    material: { kind: 'lambertian', albedo: [0.52, 0.5, 0.47] },
    motion: { kind: 'static' },
  }

  const glassCore: Primitive = {
    kind: 'sphere',
    center: [0, 1.0, 0],
    radius: 1.0,
    material: {
      kind: 'dielectric',
      albedo: [1, 1, 1],
      ior: 1.52,
      attenuation: [0.98, 0.99, 1.0],
    },
    motion: { kind: 'static' },
  }

  const matteMetal: Primitive = {
    kind: 'sphere',
    center: [-1.9, 0.7, 0.6],
    radius: 0.7,
    material: { kind: 'metal', albedo: [0.85, 0.86, 0.88], roughness: 0.35 },
    motion: { kind: 'static' },
  }

  const goldMirror: Primitive = {
    kind: 'sphere',
    center: [1.9, 0.55, -0.4],
    radius: 0.55,
    material: { kind: 'metal', albedo: [1.0, 0.78, 0.38], roughness: 0.02 },
    motion: { kind: 'static' },
  }

  const T = 40 / 24
  const redRunner: Primitive = {
    kind: 'sphere',
    center: [-1.2, 0.35, -1.3],
    radius: 0.35,
    material: { kind: 'lambertian', albedo: [0.83, 0.25, 0.2] },
    motion: { kind: 'linear', velocity: [2.4 / T, 0, 0] },
  }

  const omega = ((14 * Math.PI) / 180) * 24
  const blueBead: Primitive = {
    kind: 'sphere',
    center: [0, 0.9, 0],
    radius: 0.28,
    material: {
      kind: 'dielectric',
      albedo: [1, 1, 1],
      ior: 1.45,
      attenuation: [0.95, 0.98, 1.0],
    },
    motion: { kind: 'orbit', radius: 2.6, omega, phase: 0, baseY: 0.9 },
  }

  const sky: Scene['sky'] = {
    zenith: [0.32, 0.4, 0.55],
    horizon: [0.82, 0.76, 0.66],
    intensity: 1.0,
    lobeDirection: normalize3([0.3, 0.8, 0.4]),
    lobePower: 28,
    lobeIntensity: 3.0,
  }

  return { primitives: [ground, glassCore, matteMetal, goldMirror, redRunner, blueBead], sky }
}

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2])
  return [v[0] / len, v[1] / len, v[2] / len]
}
