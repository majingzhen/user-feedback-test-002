import type { CodecSupport } from './codec_probe.js'

// drawFrame 负责把第 i 帧绘制到 canvas 上；编码完成后返回 WebM Blob
export async function encodeWebm(
  canvas: HTMLCanvasElement,
  support: CodecSupport,
  frameCount: number,
  fps: number,
  drawFrame: (frameIndex: number) => Promise<void>,
): Promise<Blob> {
  const { Muxer, ArrayBufferTarget } = await import('webm-muxer')
  const width = canvas.width
  const height = canvas.height
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: support.codec === 'vp9' ? 'V_VP9' : 'V_VP8', width, height },
  })

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      throw err
    },
  })
  encoder.configure({
    codec: support.codec,
    width,
    height,
    bitrate: 8_000_000,
    framerate: fps,
  })

  const frameDuration = Math.round(1_000_000 / fps)
  for (let i = 0; i < frameCount; i++) {
    await drawFrame(i)
    const frame = new VideoFrame(canvas, { timestamp: i * frameDuration, duration: frameDuration })
    encoder.encode(frame)
    frame.close()
  }
  await encoder.flush()
  muxer.finalize()
  encoder.close()
  return new Blob([muxer.target.buffer], { type: 'video/webm' })
}
