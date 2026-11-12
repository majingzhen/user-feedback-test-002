import type { Primitive, Vec3 } from '../scene/types.js'

// 解析运动求值，与 GLSL chunks/motion.ts 同公式。time 单位秒。
export function sampleCenter(p: Primitive, time: number): Vec3 {
  const c = p.center
  switch (p.motion.kind) {
    case 'static':
      return c
    case 'linear': {
      const v = p.motion.velocity
      return [c[0] + v[0] * time, c[1] + v[1] * time, c[2] + v[2] * time]
    }
    case 'orbit': {
      const m = p.motion
      const a = m.omega * time + m.phase
      return [c[0] + m.radius * Math.cos(a), m.baseY, c[2] + m.radius * Math.sin(a)]
    }
  }
}
