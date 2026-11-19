import type { GraphNode, GraphOptions } from '../types.js'
import type { Resources } from './gl.js'

export class Artwork {
  #textures: WebGLTexture[] = []
  #allocated = [false, false]
  #cells: { url: string; nodes: number[] }[] = []
  #pending = new Set<HTMLImageElement>()
  #cursor = 0
  #tile?: HTMLCanvasElement
  #dead = false
  constructor(
    private res: Resources,
    private ready: (slot: number, nodes: number[]) => void,
  ) {
    const gl = res.gl
    // Complete samplers on frame zero. Allocate a full sheet only when its first image decodes.
    for (let unit = 1; unit <= 2; unit++) {
      this.#textures.push(res.texture(unit, true))
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }
  }
  start(nodes: readonly GraphNode[], art: GraphOptions['art']) {
    const byURL = new Map<string, number>()
    for (let i = 0; i < nodes.length; i++) {
      const url = art ? art.urlFor(nodes[i]) : nodes[i].art
      if (!url) continue
      const known = byURL.get(url)
      if (known !== undefined) this.#cells[known].nodes.push(i)
      else if (this.#cells.length < 2048) {
        byURL.set(url, this.#cells.length)
        this.#cells.push({ url, nodes: [i] })
      }
    }
    this.#pump()
  }
  #pump() {
    while (!this.#dead && this.#pending.size < 4 && this.#cursor < this.#cells.length) {
      const slot = this.#cursor++,
        cell = this.#cells[slot],
        img = new Image()
      this.#pending.add(img)
      img.crossOrigin = 'anonymous'
      const done = () => {
        this.#pending.delete(img)
        img.onload = img.onerror = null
        this.#pump()
      }
      img.onerror = done
      img.onload = () => {
        try {
          if (this.#dead || this.res.gl.isContextLost()) return
          const tile = (this.#tile ??= document.createElement('canvas'))
          if (tile.width !== 64 || tile.height !== 64) tile.width = tile.height = 64
          const ctx = tile.getContext('2d')!,
            side = Math.min(img.naturalWidth, img.naturalHeight)
          ctx.clearRect(0, 0, 64, 64)
          ctx.drawImage(
            img,
            (img.naturalWidth - side) / 2,
            (img.naturalHeight - side) / 2,
            side,
            side,
            0,
            0,
            64,
            64,
          )
          const sheet = slot >> 10,
            gl = this.res.gl
          gl.activeTexture(gl.TEXTURE1 + sheet)
          gl.bindTexture(gl.TEXTURE_2D, this.#textures[sheet])
          if (!this.#allocated[sheet]) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, 2048, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
            this.#allocated[sheet] = true
          }
          gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            (slot & 31) * 64,
            ((slot >> 5) & 31) * 64,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            tile,
          )
          this.ready(slot + 1, cell.nodes)
        } finally {
          done()
        }
      }
      img.src = cell.url
    }
  }
  destroy() {
    this.#dead = true
    for (const img of this.#pending) {
      img.onload = img.onerror = null
      img.removeAttribute('src')
    }
    this.#pending.clear()
  }
}
