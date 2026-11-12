// 双 RGBA32F 纹理 ping-pong：shader 内 old + new_sample 互写，
// 不依赖 EXT_float_blend，且 sample 严格串行累加（续算按位一致的前提）
export class AccumTextures {
  private textures: [WebGLTexture, WebGLTexture]
  private framebuffers: [WebGLFramebuffer, WebGLFramebuffer]
  private readIndex = 0

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly width: number,
    readonly height: number,
  ) {
    this.textures = [this.createTexture(), this.createTexture()]
    this.framebuffers = [this.createFbo(this.textures[0]), this.createFbo(this.textures[1])]
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl
    const tex = gl.createTexture()
    if (!tex) throw new Error('创建浮点纹理失败')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.FLOAT,
      null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  private createFbo(tex: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl
    const fbo = gl.createFramebuffer()
    if (!fbo) throw new Error('创建 FBO 失败')
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`浮点 FBO 不完整，状态码 ${status}`)
    }
    return fbo
  }

  get readTexture(): WebGLTexture {
    return this.textures[this.readIndex]
  }

  get writeFramebuffer(): WebGLFramebuffer {
    return this.framebuffers[1 - this.readIndex]
  }

  swap(): void {
    this.readIndex = 1 - this.readIndex
  }

  clear(): void {
    const gl = this.gl
    for (const fbo of this.framebuffers) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
  }

  // 续算：把历史累积回灌到当前 read 纹理
  restoreRead(buffer: Float32Array): void {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.readTexture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.FLOAT,
      buffer,
    )
  }

  readPixels(): Float32Array {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.readIndex])
    const out = new Float32Array(this.width * this.height * 4)
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, out)
    return out
  }

  destroy(): void {
    const gl = this.gl
    this.textures.forEach((t) => gl.deleteTexture(t))
    this.framebuffers.forEach((f) => gl.deleteFramebuffer(f))
  }
}
