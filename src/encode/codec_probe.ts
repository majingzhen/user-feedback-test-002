export interface CodecSupport {
  codec: 'vp9' | 'vp8'
  mimeType: string
}

// 启动时探测，全失败则视频导出置灰，PNG 序列作为合同级保底
export async function probeEncoders(
  width: number,
  height: number,
  fps: number,
): Promise<CodecSupport | null> {
  if (typeof VideoEncoder === 'undefined') return null
  const candidates: CodecSupport[] = [
    { codec: 'vp9', mimeType: 'video/webm;codecs=vp9' },
    { codec: 'vp8', mimeType: 'video/webm;codecs=vp8' },
  ]
  for (const c of candidates) {
    try {
      const supported = await VideoEncoder.isConfigSupported({
        codec: c.codec,
        width,
        height,
        bitrate: 8_000_000,
        framerate: fps,
      })
      if (supported.supported) return c
    } catch {
      // 继续尝试下一个
    }
  }
  return null
}
