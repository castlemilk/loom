import type { Model } from '../model.js'
import type { Camera } from '../camera.js'
import type { GraphOptions, LayoutOptions, Mode, Theme } from '../types.js'
import { rgb } from '../theme.js'
import { wireOpacity } from '../appearance.js'
import { Resources, uniforms } from './gl.js'
import {
  wireVertex,
  wireFragment,
  nodeVertex,
  nodeFragment,
  gridVertex,
  gridFragment,
} from './shaders.js'
import { Artwork } from './art.js'
import { Labels } from './labels.js'

interface Pipeline {
  p: WebGLProgram
  vao: WebGLVertexArrayObject
}
export class Renderer {
  #res: Resources
  #node: Pipeline
  #background?: Pipeline
  #wire: Pipeline
  #positions: WebGLTexture
  #nodeColors: WebGLBuffer
  #wireColors?: WebGLBuffer
  #wireWidths?: WebGLBuffer
  #neighbors: WebGLBuffer
  #artCodes: WebGLBuffer
  #slots: Uint16Array
  #slotsDirty = false
  #art: Artwork
  #labels?: Labels
  #hasLabels = false
  #artStarted = false
  #extras = false
  #scene = new Float32Array(48)
  #sceneBuffer: WebGLBuffer
  #segments: number
  draws = 0
  labelCount = 0
  imageTiles = 0
  #gl: WebGL2RenderingContext
  #model: Model
  #options: GraphOptions
  #theme: Theme
  constructor(
    gl: WebGL2RenderingContext,
    model: Model,
    options: GraphOptions,
    theme: Theme,
    wake: () => void,
  ) {
    this.#gl = gl
    this.#model = model
    this.#options = options
    this.#theme = theme
    const r = (this.#res = new Resources(gl))
    try {
      const nodes = r.program(nodeVertex, nodeFragment),
        wires = r.program(wireVertex, wireFragment)
      this.#wire = { p: wires, vao: r.vao() }
      r.attribute(0, 2, gl.UNSIGNED_INT, false, model.endpoints)
      this.#node = { p: nodes, vao: r.vao() }
      this.#nodeColors = r.attribute(0, 4, gl.UNSIGNED_BYTE, true, model.look.style, true)
      this.#slots = new Uint16Array(model.n)
      this.#artCodes = r.attribute(1, 1, gl.UNSIGNED_SHORT, false, this.#slots, true)
      this.#neighbors = r.attribute(2, 1, gl.UNSIGNED_BYTE, false, new Uint8Array(model.n), true)
      this.#positions = r.texture(0, false)
      const w = Math.min(256, Math.max(1, model.n))
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        w,
        model.positions.length / 4 / w,
        0,
        gl.RGBA,
        gl.FLOAT,
        model.positions,
      )
      this.#art = new Artwork(r, (slot, indices) => {
        this.imageTiles++
        for (const i of indices) this.#slots[i] = slot
        this.#slotsDirty = true
        wake()
      })
      this.#segments = model.endpoints.length > 90000 ? 5 : model.endpoints.length > 12000 ? 8 : 16
      this.#scene[14] = this.#segments
      this.#sceneBuffer = r.uniformBlock(this.#scene)
      this.setTheme(theme, true)
      this.setLayout(options.layout ?? {}, options.mode ?? 'drift')
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    } catch (error) {
      r.destroy()
      throw error
    }
  }
  setTheme(theme: Theme, initial = false) {
    this.#theme = theme
    const gl = this.#gl,
      { look } = this.#model,
      wires = theme.wires ?? {}
    if (!initial) this.#res.update(this.#nodeColors, look.style)
    gl.bindVertexArray(this.#wire.vao)
    if (look.wireColors && look.wireWidths) {
      if (this.#wireColors && this.#wireWidths) {
        gl.enableVertexAttribArray(1)
        gl.enableVertexAttribArray(2)
        this.#res.update(this.#wireColors, look.wireColors)
        this.#res.update(this.#wireWidths, look.wireWidths)
      } else {
        this.#wireColors = this.#res.attribute(1, 4, gl.UNSIGNED_BYTE, true, look.wireColors, true)
        this.#wireWidths = this.#res.attribute(2, 1, gl.FLOAT, false, look.wireWidths, true)
      }
    } else if (this.#wireColors) {
      gl.disableVertexAttribArray(1)
      gl.disableVertexAttribArray(2)
    }
    gl.bindVertexArray(null)
    const background = rgb(theme.bg).map((v) => v / 255)
    gl.clearColor(background[0], background[1], background[2], 1)
    this.#scene[15] = wires.opacity ?? wireOpacity(this.#model.n)
    for (const [i, color] of [theme.bg, theme.bezel, theme.accent, wires.color ?? theme.dim].entries())
      this.#scene.set(
        rgb(color).map((v) => v / 255),
        16 + 4 * i,
      )
    this.#scene[32] = wires.routing === 'patch' ? 1 : wires.routing === 'straight' ? 2 : 0
    this.#scene[33] = look.stroke
    this.#scene[34] = wires.hotWidth ?? 2.3
    this.#scene[35] = Number(!!look.wireColors)
    this.#scene[36] = theme.nodes?.ringWidth ?? 1.3
    this.#scene[37] = theme.nodes?.fill ?? 0.38
    this.#scene[38] = theme.grid?.spacing ?? 32
    this.#scene[39] = Number(theme.nodes?.artwork !== false)
    this.#scene.set(
      rgb(theme.grid?.color ?? theme.dim).map((v) => v / 255),
      40,
    )
    this.#scene[43] = theme.grid ? (theme.grid.opacity ?? 0.2) : 0
    this.#labels?.setTheme(theme)
  }
  setLayout(layout: LayoutOptions, mode: Mode) {
    this.#scene[44] = this.#model.laneMap.offsets.size
    this.#scene[45] = this.#model.laneMap.gap
    this.#scene[46] = layout.guides && !layout.anchor && mode !== 'orbit' ? (mode === 'lanes' ? 1 : layout.blend ?? 0) * 0.32 : 0
    this.#scene[47] = Number(layout.direction === 'vertical')
  }
  pickLabel(x: number, y: number) {
    return this.#labels?.grid.pick(x, y) ?? -1
  }
  neighborhood(flags: Uint8Array) {
    this.#res.update(this.#neighbors, flags)
  }
  upload(p: Float32Array) {
    const gl = this.#gl,
      w = Math.min(256, Math.max(1, this.#model.n))
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.#positions)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, p.length / 4 / w, gl.RGBA, gl.FLOAT, p)
  }
  paint(
    camera: Camera,
    selected: number,
    hovered: number,
    projected: Float32Array | null,
    adjacent: Uint8Array,
  ) {
    const gl = this.#gl,
      b = camera.basis()
    this.draws = this.labelCount = 0
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (!this.#model.n) return
    if (this.#slotsDirty) {
      this.#res.update(this.#artCodes, this.#slots)
      this.#slotsDirty = false
    }
    const scene = this.#scene
    scene[0] = camera.width
    scene[1] = camera.height
    scene[2] = camera.zoom
    scene[3] = camera.zoom / camera.focal
    scene[4] = camera.x
    scene[5] = camera.y
    scene[6] = camera.z
    scene[7] = Number(camera.mode === 'cloud')
    scene.set(b, 8)
    scene[12] = selected
    scene[13] = hovered
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.#sceneBuffer)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, scene)
    const view = ({ p, vao }: Pipeline) => {
      gl.useProgram(p)
      gl.bindVertexArray(vao)
    }
    if (camera.mode !== 'cloud' && (scene[43] || scene[46])) {
      if (!this.#background) {
        const p = this.#res.program(gridVertex, gridFragment)
        this.#res.check(p)
        this.#background = { p, vao: this.#res.vao() }
      }
      view(this.#background)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 1)
      this.draws++
    }
    const cloud = camera.mode === 'cloud'
    if (cloud) {
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      view(this.#node)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.#model.n)
      gl.depthMask(false)
    }
    if (this.#model.endpoints.length) {
      view(this.#wire)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        (this.#segments + 1) * 2,
        this.#model.endpoints.length / 2,
      )
      this.draws++
    }
    if (cloud) {
      gl.depthMask(true)
      gl.disable(gl.DEPTH_TEST)
    } else {
      view(this.#node)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.#model.n)
    }
    this.draws++
    if (projected) {
      if (!this.#extras) {
        this.#extras = true
        this.#res.check(this.#node.p)
        this.#res.check(this.#wire.p)
        gl.useProgram(this.#node.p)
        const u = uniforms(gl, this.#node.p, ['art0', 'art1'])
        gl.uniform1i(u.art0, 1)
        gl.uniform1i(u.art1, 2)
        this.#hasLabels = this.#options.nodes.some((n) => n.label)
      }
      if (
        !this.#labels &&
        this.#hasLabels &&
        this.#theme.labels?.visibility !== 'none' &&
        this.#theme.labels?.density !== 0
      )
        this.#labels = new Labels(this.#options.nodes, this.#model.degree, this.#theme, this.#res)
      if (!this.#artStarted && this.#theme.nodes?.artwork !== false) {
        this.#artStarted = true
        this.#art.start(this.#options.nodes, this.#options.art)
      }
      this.labelCount =
        this.#labels?.draw(projected, camera.width, camera.height, selected, hovered, adjacent) ?? 0
      if (this.labelCount) this.draws++
    }
    gl.bindVertexArray(null)
  }
  destroy() {
    this.#art.destroy()
    this.#res.destroy()
  }
}
