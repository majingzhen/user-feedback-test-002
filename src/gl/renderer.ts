import { FOV_Y_DEG, LOOK_AT, ORBIT_HEIGHT, ORBIT_RADIUS, frameShutter } from '../core/camera/camera.js'
import type { RenderConfig } from '../core/config/types.js'
import type { Scene } from '../core/scene/types.js'
import type { EngineRenderer } from '../core/engine/engine.js'
import type { StoredFrame } from '../core/storage/types.js'
import { hashToU32 } from '../core/scene/scene_hash.js'
import { buildShaderDefines } from '../shaders/assemble.js'
import { buildDisplaySource, buildQuadVertexSource } from '../shaders/display.js'
import { buildTracerSource } from '../shaders/tracer.js'
import { AccumTextures } from './textures.js'
import { Uniforms, linkProgram } from './program.js'
import { uploadScene } from './scene_upload.js'

export class GlRenderer implements EngineRenderer {
  private readonly tracer: WebGLProgram
  private readonly display: WebGLProgram
  private readonly tracerU: Uniforms
  private readonly displayU: Uniforms
  private readonly vao: WebGLVertexArrayObject
  private readonly ubo: WebGLBuffer
  private readonly accum: AccumTextures
  private readonly outputTex: WebGLTexture
  private readonly outputFbo: WebGLFramebuffer
  private readonly fovTanHalf = Math.tan((FOV_Y_DEG * Math.PI) / 180 / 2)

  constructor(
    private readonly gl: WebGL2RenderingContext,
    scene: Scene,
    private readonly config: RenderConfig,
    configHash: string,
    private readonly configHashU32 = hashToU32(configHash),
  ) {
    void scene
    const vs = buildQuadVertexSource()
    this.tracer = linkProgram(gl, vs, buildTracerSource(buildShaderDefines(config)))
    this.display = linkProgram(gl, vs, buildDisplaySource())
    this.tracerU = new Uniforms(gl, this.tracer)
    this.displayU = new Uniforms(gl, this.display)
    this.vao = gl.createVertexArray()!
    this.ubo = gl.createBuffer()!
    uploadScene(gl, this.ubo, scene)
    this.accum = new AccumTextures(gl, config.width, config.height)
    const srgb = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, srgb)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.SRGB8_ALPHA8,
      config.width,
      config.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    this.outputTex = srgb
    this.outputFbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputFbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, srgb, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('sRGB 输出 FBO 不完整')
    }
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
  }

  async prepareFrame(frameIndex: number, existing: StoredFrame | null): Promise<void> {
    void frameIndex
    if (existing) {
      this.accum.restoreRead(existing.buffer)
    } else {
      this.accum.clear()
    }
  }

  async runPass(frameIndex: number, sampleBase: number): Promise<number> {
    const gl = this.gl
    const cfg = this.config
    const shutter = frameShutter(frameIndex, cfg)

    gl.bindVertexArray(this.vao)
    gl.useProgram(this.tracer)
    gl.uniformBlockBinding(this.tracer, gl.getUniformBlockIndex(this.tracer, 'SceneBlock'), 0)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.accum.readTexture)
    gl.uniform1i(this.tracerU.loc('u_accumTex'), 0)

    gl.uniform1ui(this.tracerU.loc('u_configHash'), this.configHashU32)
    gl.uniform1ui(this.tracerU.loc('u_frameIndex'), frameIndex)
    gl.uniform1ui(this.tracerU.loc('u_sampleBase'), sampleBase)
    gl.uniform1f(this.tracerU.loc('u_shutterStart'), shutter.start)
    gl.uniform1f(this.tracerU.loc('u_shutterSpan'), shutter.end - shutter.start)
    gl.uniform3fv(this.tracerU.loc('u_lookAt'), LOOK_AT)
    gl.uniform1f(this.tracerU.loc('u_orbitRadius'), ORBIT_RADIUS)
    gl.uniform1f(this.tracerU.loc('u_orbitHeight'), ORBIT_HEIGHT)
    gl.uniform1f(this.tracerU.loc('u_duration'), cfg.frameCount / cfg.fps)
    gl.uniform1f(this.tracerU.loc('u_fovTanHalf'), this.fovTanHalf)
    gl.uniform2f(this.tracerU.loc('u_resolution'), cfg.width, cfg.height)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.writeFramebuffer)
    gl.viewport(0, 0, cfg.width, cfg.height)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.accum.swap()
    return sampleBase + cfg.sppPerPass
  }

  // 线性值渲染进 sRGB FBO（精确编码），再 blit 到画布；预览与 PNG 共用同一缓冲
  showPreview(spp: number): void {
    const gl = this.gl
    const cfg = this.config
    gl.bindVertexArray(this.vao)
    gl.useProgram(this.display)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.accum.readTexture)
    gl.uniform1i(this.displayU.loc('u_accumTex'), 0)
    gl.uniform1f(this.displayU.loc('u_spp'), spp)
    gl.uniform1f(this.displayU.loc('u_exposure'), 1.35)
    gl.uniform2f(this.displayU.loc('u_resolution'), cfg.width, cfg.height)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputFbo)
    gl.viewport(0, 0, cfg.width, cfg.height)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.outputFbo)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    gl.blitFramebuffer(
      0, 0, cfg.width, cfg.height,
      0, 0, cfg.width, cfg.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  async readAccumulation(): Promise<Float32Array> {
    return this.accum.readPixels()
  }

  async renderThumbnail(): Promise<Blob> {
    this.showPreview(this.config.targetSpp)
    const canvas = this.gl.canvas as HTMLCanvasElement
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('缩略图导出失败'))
      }, 'image/png')
    })
  }

  destroy(): void {
    const gl = this.gl
    this.accum.destroy()
    gl.deleteTexture(this.outputTex)
    gl.deleteFramebuffer(this.outputFbo)
    gl.deleteBuffer(this.ubo)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.tracer)
    gl.deleteProgram(this.display)
  }
}
