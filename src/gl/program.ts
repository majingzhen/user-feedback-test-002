export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('创建 shader 失败')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '未知编译错误'
    gl.deleteShader(shader)
    throw new Error(`Shader 编译失败:\n${log}\n--- 源码 ---\n${source}`)
  }
  return shader
}

export function linkProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  if (!program) throw new Error('创建 program 失败')
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '未知链接错误'
    gl.deleteProgram(program)
    throw new Error(`Program 链接失败: ${log}`)
  }
  return program
}

export class Uniforms {
  private cache = new Map<string, WebGLUniformLocation | null>()

  constructor(private readonly gl: WebGL2RenderingContext, private readonly program: WebGLProgram) {}

  loc(name: string): WebGLUniformLocation | null {
    let loc = this.cache.get(name)
    if (loc === undefined) {
      loc = this.gl.getUniformLocation(this.program, name)
      this.cache.set(name, loc)
    }
    return loc
  }
}
