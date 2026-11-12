export interface GlCaps {
  renderer: string
  vendor: string
  colorBufferFloat: boolean
  floatBlend: boolean
  isSoftware: boolean
}

export function createGlContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  if (!gl) throw new Error('当前环境不支持 WebGL2，无法启动路径追踪')
  return gl
}

export function glProbe(gl: WebGL2RenderingContext): GlCaps {
  const colorBufferFloat = gl.getExtension('EXT_color_buffer_float') !== null
  const floatBlend = gl.getExtension('EXT_float_blend') !== null
  let renderer = 'unknown'
  let vendor = 'unknown'
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  if (info) {
    renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
    vendor = String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL))
  }
  const lower = renderer.toLowerCase()
  const isSoftware =
    lower.includes('swiftshader') || lower.includes('software') || lower.includes('llvmpipe')
  if (!colorBufferFloat) {
    throw new Error('缺少 EXT_color_buffer_float 扩展，浮点累积缓冲不可用')
  }
  return { renderer, vendor, colorBufferFloat, floatBlend, isSoftware }
}
