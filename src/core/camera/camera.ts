import type { RenderConfig } from '../config/types.js'
import { normalize, sub } from '../math/vec3.js'

export interface CameraRay {
  origin: [number, number, number]
  forward: [number, number, number]
  fovYDeg: number
}

export const LOOK_AT: [number, number, number] = [0, 0.6, 0]
export const ORBIT_RADIUS = 5.0
export const ORBIT_HEIGHT = 1.6
export const FOV_Y_DEG = 50

// 相机沿 360° 轨道连续运动；time 为序列内秒数，运动模糊时取快门窗口内随机时刻
export function sampleCamera(time: number, cfg: RenderConfig): CameraRay {
  const duration = cfg.frameCount / cfg.fps
  const theta = (2 * Math.PI * time) / duration
  const origin: [number, number, number] = [
    ORBIT_RADIUS * Math.cos(theta),
    ORBIT_HEIGHT,
    ORBIT_RADIUS * Math.sin(theta),
  ]
  return {
    origin,
    forward: normalize(sub(LOOK_AT, origin)),
    fovYDeg: 50,
  }
}

// 帧快门窗口 [start, start + shutter]
export function frameShutter(frameIndex: number, cfg: RenderConfig): { start: number; end: number } {
  const start = frameIndex / cfg.fps
  return { start, end: start + cfg.shutterFraction / cfg.fps }
}
