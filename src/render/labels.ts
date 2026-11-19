import type { GraphNode, Theme } from '../types.js'
import { rgb } from '../theme.js'
import { Resources, uniforms } from './gl.js'
import { LabelGrid } from './grid.js'
import { labelVertex, labelFragment } from './shaders.js'

interface Glyph {
  x: number
  y: number
  width: number
  advance: number
}
const atlasSize = 1024,
  maxLabels = 144,
  maxChars = 36
export class Labels {
  private board: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private texture: WebGLTexture
  private glyphs = new Map<string, Glyph>()
  private x = 0
  private y = 0
  private row = 0
  private dirty = false
  private order: Uint32Array
  private widths: Float32Array
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private rect: WebGLBuffer
  private uv: WebGLBuffer
  private rects = new Float32Array(maxLabels * maxChars * 4)
  private uvs = new Float32Array(this.rects.length)
  readonly grid = new LabelGrid()
  private u: ReturnType<typeof uniforms<'viewport' | 'atlas' | 'ink' | 'bg' | 'plateAlpha'>>
  constructor(
    private items: readonly GraphNode[],
    degree: Uint32Array,
    private theme: Theme,
    private res: Resources,
  ) {
    const gl = res.gl
    this.board = document.createElement('canvas')
    this.board.width = this.board.height = atlasSize
    this.ctx = this.board.getContext('2d')!
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = 'white'
    this.order = Uint32Array.from(items, (_, i) => i).sort((a, b) => degree[b] - degree[a] || a - b)
    this.widths = new Float32Array(items.length)
    this.program = res.program(labelVertex, labelFragment)
    res.check(this.program)
    this.vao = res.vao()
    this.rect = res.attribute(0, 4, gl.FLOAT, false, this.rects, true)
    this.uv = res.attribute(1, 4, gl.FLOAT, false, this.uvs, true)
    this.texture = res.texture(3, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlasSize, atlasSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.useProgram(this.program)
    this.u = uniforms(gl, this.program, ['viewport', 'atlas', 'ink', 'bg', 'plateAlpha'])
    gl.uniform1i(this.u.atlas, 3)
    this.setTheme(theme)
  }
  setTheme(theme: Theme) {
    const gl = this.res.gl,
      u = this.u
    if (!this.row || this.theme.font !== theme.font || this.theme.fontSize !== theme.fontSize) {
      this.ctx.clearRect(0, 0, atlasSize, atlasSize)
      this.ctx.font = theme.fontSize * 2 + 'px ' + theme.font
      this.row = Math.ceil(theme.fontSize * 3 + 6)
      this.x = this.y = 0
      this.widths.fill(0)
      this.glyphs.clear()
      this.glyph('�')
    }
    this.theme = theme
    gl.useProgram(this.program)
    gl.uniform3fv(
      u.ink,
      rgb(theme.ink).map((v) => v / 255),
    )
    gl.uniform3fv(
      u.bg,
      rgb(theme.bg).map((v) => v / 255),
    )
    gl.uniform1f(u.plateAlpha, theme.plateAlpha)
  }
  private glyph(letter: string): Glyph {
    const cached = this.glyphs.get(letter)
    if (cached) return cached
    const advance = this.ctx.measureText(letter).width
    const width = Math.min(atlasSize, Math.ceil(advance) + 6)
    if (this.x + width > atlasSize) {
      this.x = 0
      this.y += this.row
    }
    if (this.y + this.row > atlasSize) return this.glyphs.get('�')!
    const g = { x: this.x, y: this.y, width, advance }
    this.ctx.fillText(letter, this.x + 3, this.y + this.row / 2)
    this.x += width
    this.glyphs.set(letter, g)
    this.dirty = true
    return g
  }
  draw(
    p: Float32Array,
    width: number,
    height: number,
    selected: number,
    hovered: number,
    adjacent: Uint8Array,
  ) {
    let count = 0,
      glyphCount = 0,
      candidates = 0
    this.grid.clear()
    const policy = this.theme.labels
    if (
      policy?.visibility === 'none' ||
      policy?.density === 0 ||
      (policy?.visibility === 'focus' && selected < 0 && hovered < 0)
    )
      return 0
    const cap = Math.min(
      maxLabels,
      Math.ceil(Math.max(8, Math.floor((width * height) / 5600)) * (policy?.density ?? 1)),
    )
    for (let q = -2; q < this.order.length && count < cap && candidates < cap * 12; q++) {
      const i = q === -2 ? hovered : q === -1 ? selected : this.order[q]
      if (i < 0 || (q >= 0 && (i === selected || i === hovered)) || (q === -1 && i === hovered)) continue
      if (selected >= 0 && i !== hovered && !adjacent[i]) continue
      if (policy?.visibility === 'focus' && selected < 0 && i !== hovered) continue
      let label = this.items[i].label
      if (!label) continue
      const k = i * 4,
        y = p[k + 1]
      let x = p[k] + p[k + 2] + 4
      if (
        p[k] < -p[k + 2] ||
        p[k] > width + p[k + 2] ||
        y - this.row / 4 < 0 ||
        y + this.row / 4 > height
      )
        continue
      if (label.length > maxChars)
        label =
          Array.from(label)
            .slice(0, maxChars - 1)
            .join('') + '…'
      candidates++
      const w = this.widths[i] || (this.widths[i] = this.ctx.measureText(label).width / 2)
      const place = (x: number) =>
        x >= 0 && x + w + 3 <= width && this.grid.place(x - 2, y - this.row / 4, w + 5, this.row / 2, i)
      if (!place(x)) {
        if (!policy?.alternateSide) continue
        x = p[k] - p[k + 2] - 4 - w
        if (!place(x)) continue
      }
      let left = x
      for (const ch of label) {
        const g = this.glyph(ch),
          j = glyphCount++ * 4
        this.rects[j] = left - 1.5
        this.rects[j + 1] = y - this.row / 4
        this.rects[j + 2] = g.width / 2
        this.rects[j + 3] = this.row / 2
        this.uvs[j] = g.x
        this.uvs[j + 1] = g.y
        this.uvs[j + 2] = g.width
        this.uvs[j + 3] = this.row
        left += g.advance / 2
      }
      count++
    }
    if (!glyphCount) return 0
    const gl = this.res.gl
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    if (this.dirty) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.board)
      this.dirty = false
    }
    gl.useProgram(this.program)
    gl.uniform2f(this.u.viewport, width, height)
    gl.bindVertexArray(this.vao)
    this.res.update(this.rect, this.rects.subarray(0, glyphCount * 4))
    this.res.update(this.uv, this.uvs.subarray(0, glyphCount * 4))
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, glyphCount)
    return count
  }
}
