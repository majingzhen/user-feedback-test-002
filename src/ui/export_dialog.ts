import type { RenderEngine } from '../core/engine/engine.js'
import type { GlRenderer } from '../gl/renderer.js'
import type { CodecSupport } from '../encode/codec_probe.js'
import { encodeWebm } from '../encode/video_encoder.js'
import { canvasToPng, downloadBlob } from '../encode/png.js'

interface DirectoryHandleLike {
  getFileHandle(name: string, opts: { create: boolean }): Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>
}

async function pickDirectory(): Promise<DirectoryHandleLike | null> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirectoryHandleLike> })
    .showDirectoryPicker
  if (!picker) return null
  try {
    return await picker()
  } catch {
    return null
  }
}

function frameName(i: number): string {
  return `frame_${String(i).padStart(4, '0')}.png`
}

// 逐帧回放浮点累积 → tonemap → PNG；优先写入选定目录，否则逐个下载
export async function exportPngSequence(
  engine: RenderEngine,
  canvas: HTMLCanvasElement,
  frameCount: number,
  onProgress: (msg: string) => void,
): Promise<number> {
  const dir = await pickDirectory()
  const renderer = engine.getRenderer() as GlRenderer
  let count = 0
  for (let i = 0; i < frameCount; i++) {
    const spp = await engine.replayFrame(i)
    renderer.showPreview(spp)
    const blob = await canvasToPng(canvas)
    if (dir) {
      const handle = await dir.getFileHandle(frameName(i), { create: true })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
    } else {
      downloadBlob(blob, frameName(i))
    }
    count++
    onProgress(`PNG 导出 ${count}/${frameCount}`)
  }
  return count
}

export async function exportVideo(
  engine: RenderEngine,
  canvas: HTMLCanvasElement,
  support: CodecSupport,
  frameCount: number,
  fps: number,
  onProgress: (msg: string) => void,
): Promise<Blob> {
  const renderer = engine.getRenderer() as GlRenderer
  const blob = await encodeWebm(
    canvas,
    support,
    frameCount,
    fps,
    async (i) => {
      const spp = await engine.replayFrame(i)
      renderer.showPreview(spp)
      onProgress(`视频编码 ${i + 1}/${frameCount}`)
    },
  )
  downloadBlob(blob, 'path-tracer-animation.webm')
  return blob
}
