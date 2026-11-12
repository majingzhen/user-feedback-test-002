import type { Scene } from '../core/scene/types.js'
import { MAX_PRIMITIVES } from '../shaders/assemble.js'

// std140 布局：6 组物体 vec4 数组 + 3 个天空 vec4，单 UBO
const VEC4 = 16
const SKY_OFFSET = 6 * MAX_PRIMITIVES * VEC4
export const SCENE_UBO_SIZE = SKY_OFFSET + 3 * VEC4

const KIND_CODE = { lambertian: 0, metal: 1, dielectric: 2 } as const
const MOTION_CODE = { static: 0, linear: 1, orbit: 2 } as const

export function packScene(scene: Scene): ArrayBuffer {
  const buf = new ArrayBuffer(SCENE_UBO_SIZE)
  const f = new Float32Array(buf)
  const u = new Uint32Array(buf)

  const set4 = (vec4Index: number, x: number, y: number, z: number, w: number): void => {
    const o = vec4Index * 4
    f[o] = x
    f[o + 1] = y
    f[o + 2] = z
    f[o + 3] = w
  }

  scene.primitives.forEach((p, i) => {
    if (i >= MAX_PRIMITIVES) throw new Error(`物体数量超过上限 ${MAX_PRIMITIVES}`)
    set4(i, p.center[0], p.center[1], p.center[2], p.radius)
    set4(MAX_PRIMITIVES + i, p.material.albedo[0], p.material.albedo[1], p.material.albedo[2], 0)
    u[(MAX_PRIMITIVES + i) * 4 + 3] = KIND_CODE[p.material.kind]
    set4(
      2 * MAX_PRIMITIVES + i,
      p.material.roughness ?? 0,
      p.material.ior ?? 1,
      MOTION_CODE[p.motion.kind],
      p.kind === 'plane' ? 1 : 0,
    )
    const att = p.material.attenuation ?? [1, 1, 1]
    set4(3 * MAX_PRIMITIVES + i, att[0], att[1], att[2], 0)
    if (p.motion.kind === 'linear') {
      set4(4 * MAX_PRIMITIVES + i, p.motion.velocity[0], p.motion.velocity[1], p.motion.velocity[2], 0)
    }
    if (p.motion.kind === 'orbit') {
      set4(
        5 * MAX_PRIMITIVES + i,
        p.motion.radius,
        p.motion.omega,
        p.motion.phase,
        p.motion.baseY,
      )
    }
  })

  const sky = scene.sky
  set4(SKY_OFFSET / VEC4, sky.zenith[0], sky.zenith[1], sky.zenith[2], sky.intensity)
  set4(SKY_OFFSET / VEC4 + 1, sky.horizon[0], sky.horizon[1], sky.horizon[2], sky.lobePower)
  set4(
    SKY_OFFSET / VEC4 + 2,
    sky.lobeDirection[0],
    sky.lobeDirection[1],
    sky.lobeDirection[2],
    sky.lobeIntensity,
  )
  return buf
}

export function uploadScene(gl: WebGL2RenderingContext, ubo: WebGLBuffer, scene: Scene): void {
  gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
  gl.bufferData(gl.UNIFORM_BUFFER, packScene(scene), gl.STATIC_DRAW)
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo)
}
