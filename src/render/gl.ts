export class Resources {
  private buffers: WebGLBuffer[] = []
  private arrays: WebGLVertexArrayObject[] = []
  private textures: WebGLTexture[] = []
  private programs: WebGLProgram[] = []
  constructor(public gl: WebGL2RenderingContext) {}
  program(vertex: string, fragment: string) {
    const gl = this.gl,
      p = gl.createProgram()!
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, '#version 300 es\nprecision highp float;\nprecision highp int;\n' + source)
      gl.compileShader(shader)
      gl.attachShader(p, shader)
      gl.deleteShader(shader)
    }
    gl.linkProgram(p)
    this.programs.push(p)
    return p
  }
  check(p: WebGLProgram) {
    const gl = this.gl
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const errors = (gl.getAttachedShaders(p) ?? []).map((s) => gl.getShaderInfoLog(s))
      throw new Error('Loom shader: ' + [gl.getProgramInfoLog(p), ...errors].join('\n'))
    }
  }
  vao() {
    const v = this.gl.createVertexArray()!
    this.arrays.push(v)
    this.gl.bindVertexArray(v)
    return v
  }
  attribute(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    data: ArrayBufferView<ArrayBufferLike>,
    dynamic = false,
  ) {
    const gl = this.gl,
      b = gl.createBuffer()!
    this.buffers.push(b)
    gl.bindBuffer(gl.ARRAY_BUFFER, b)
    gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW)
    gl.enableVertexAttribArray(index)
    if (type === gl.UNSIGNED_INT) gl.vertexAttribIPointer(index, size, type, 0, 0)
    else gl.vertexAttribPointer(index, size, type, normalized, 0, 0)
    gl.vertexAttribDivisor(index, 1)
    return b
  }
  uniformBlock(values: Float32Array) {
    const gl = this.gl,
      buffer = gl.createBuffer()!
    this.buffers.push(buffer)
    gl.bindBuffer(gl.UNIFORM_BUFFER, buffer)
    gl.bufferData(gl.UNIFORM_BUFFER, values, gl.DYNAMIC_DRAW)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, buffer)
    return buffer
  }
  update(buffer: WebGLBuffer, data: ArrayBufferView<ArrayBufferLike>) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, data)
  }
  texture(unit: number, linear: boolean) {
    const gl = this.gl,
      t = gl.createTexture()!
    this.textures.push(t)
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    for (const param of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_2D, param, linear ? gl.LINEAR : gl.NEAREST)
    for (const param of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D, param, gl.CLAMP_TO_EDGE)
    return t
  }
  destroy() {
    const gl = this.gl
    for (const v of this.arrays) gl.deleteVertexArray(v)
    for (const b of this.buffers) gl.deleteBuffer(b)
    for (const t of this.textures) gl.deleteTexture(t)
    for (const p of this.programs) gl.deleteProgram(p)
    gl.useProgram(null)
  }
}
export function uniforms<const K extends string>(
  gl: WebGL2RenderingContext,
  p: WebGLProgram,
  keys: readonly K[],
) {
  return Object.fromEntries(keys.map((k) => [k, gl.getUniformLocation(p, k)])) as Record<
    K,
    WebGLUniformLocation | null
  >
}
