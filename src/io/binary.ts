import type { GraphData, GraphLink, GraphNode } from '../types.js'
import { pinFlag } from '../model.js'

const encoder = new TextEncoder(),
  decoder = new TextDecoder('utf-8', { fatal: true })
class Writer {
  bytes = new Uint8Array(1024)
  view = new DataView(this.bytes.buffer)
  at = 0
  room(n: number) {
    if (this.at + n <= this.bytes.length) return
    const next = new Uint8Array(Math.max(this.bytes.length * 2, this.at + n))
    next.set(this.bytes)
    this.bytes = next
    this.view = new DataView(next.buffer)
  }
  uint(n: number) {
    while (n >= 128) {
      this.bytes[this.at++] = (n & 127) | 128
      n >>>= 7
    }
    this.bytes[this.at++] = n
  }
  message(tag: number) {
    this.room(6)
    this.bytes[this.at++] = tag
    const start = this.at
    this.at += 5
    return start
  }
  finish(start: number) {
    const end = this.at,
      len = end - start - 5
    this.at = start
    this.uint(len)
    this.bytes.copyWithin(this.at, start + 5, end)
    this.at += len
  }
  string(tag: number, value?: string) {
    if (!value) return
    const start = this.message(tag)
    this.room(value.length * 3)
    this.at += encoder.encodeInto(value, this.bytes.subarray(this.at)).written
    this.finish(start)
  }
  float(tag: number, value?: number) {
    if (value === undefined) return
    this.room(5)
    this.bytes[this.at++] = tag
    this.view.setFloat32(this.at, value, true)
    this.at += 4
  }
}
export function toBinary(data: GraphData): Uint8Array {
  const w = new Writer()
  for (const n of data.nodes) {
    const start = w.message(10)
    w.string(10, n.id)
    w.string(18, n.label)
    w.string(26, n.kind)
    w.float(37, n.x)
    w.float(45, n.y)
    w.float(53, n.z)
    w.string(58, n.art)
    if (n.degree !== undefined) {
      if (!Number.isInteger(n.degree) || n.degree < 0 || n.degree > 0xffffffff)
        throw new RangeError('degree must fit uint32')
      w.room(6)
      w.bytes[w.at++] = 64
      w.uint(n.degree)
    }
    if (n.pinned !== undefined) {
      w.room(2)
      w.bytes[w.at++] = 72
      w.bytes[w.at++] = pinFlag(n.pinned)
    }
    w.finish(start)
  }
  for (const l of data.links) {
    const start = w.message(18)
    w.string(10, l.source)
    w.string(18, l.target)
    w.string(26, l.kind)
    w.finish(start)
  }
  return w.bytes.slice(0, w.at)
}

function invalid(): never {
  throw new RangeError('Invalid protobuf graph')
}
class Reader {
  at = 0
  end: number
  view: DataView
  constructor(public bytes: Uint8Array) {
    this.end = bytes.length
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  uint() {
    if (this.at >= this.end) return invalid()
    let out = this.bytes[this.at++]
    if (out < 128) return out
    out &= 127
    for (let shift = 7; shift <= 28 && this.at < this.end; shift += 7) {
      const b = this.bytes[this.at++]
      if (shift === 28 && b > 15) invalid()
      out |= (b & 127) << shift
      if (b < 128) return out >>> 0
    }
    return invalid()
  }
  limit() {
    const length = this.uint(),
      end = this.at + length
    if (end > this.end) invalid()
    return end
  }
  private shortStrings = new Map<number, string>()
  private strings = new Map<number, { start: number; length: number; text: string }>()
  string(intern = false) {
    const end = this.limit(),
      start = this.at,
      b = this.bytes,
      length = end - start
    this.at = end
    let hash = 0
    const short = intern && length <= 6
    if (short) {
      // A leading one and six bytes fit losslessly in a JavaScript integer.
      hash = 1
      for (let i = start; i < end; i++) hash = hash * 256 + b[i]
      const hit = this.shortStrings.get(hash)
      if (hit !== undefined) return hit
    } else if (intern) {
      for (let i = start; i < end; i++) hash = Math.imul(hash ^ b[i], 16777619)
      const hit = this.strings.get(hash)
      if (hit && hit.length === length) {
        let i = 0
        while (i < length && b[hit.start + i] === b[start + i]) i++
        if (i === length) return hit.text
      }
    }
    // Common IDs and labels are short ASCII. Avoid a view and native decoder
    // call for each endpoint; keep strict UTF-8 decoding for all other text.
    let text = '',
      i = start
    if (length < 64) {
      for (; i + 4 <= end; i += 4) {
        if ((b[i] | b[i + 1] | b[i + 2] | b[i + 3]) >= 128) break
        text += String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3])
      }
      while (i < end && b[i] < 128) text += String.fromCharCode(b[i++])
    }
    if (i !== end) text = decoder.decode(b.subarray(start, end))
    if (short) this.shortStrings.set(hash, text)
    else if (intern) this.strings.set(hash, { start, length, text })
    return text
  }
  float() {
    if (this.at + 4 > this.end) invalid()
    const n = this.view.getFloat32(this.at, true)
    this.at += 4
    return n
  }
  tag() {
    const tag = this.uint()
    if (tag < 8) invalid()
    return tag
  }
  skip(tag: number, depth = 0) {
    switch (tag & 7) {
      case 0:
        for (let i = 0; i < 10 && this.at < this.end; i++) {
          const b = this.bytes[this.at++]
          if (i === 9 && b > 1) invalid()
          if (b < 128) return
        }
        invalid()
      case 1:
        this.at += 8
        break
      case 2:
        this.at = this.limit()
        break
      case 3:
        if (depth >= 64) invalid()
        while (this.at < this.end) {
          const nested = this.tag()
          if ((nested & 7) === 4) {
            if (nested >>> 3 !== tag >>> 3) invalid()
            return
          }
          this.skip(nested, depth + 1)
        }
        invalid()
      case 5:
        this.at += 4
        break
      default:
        invalid()
    }
    if (this.at > this.end) invalid()
  }
}
export function fromBinary(buffer: Uint8Array | ArrayBuffer): {
  nodes: GraphNode[]
  links: GraphLink[]
} {
  const r = new Reader(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))
  const nodes: GraphNode[] = [],
    links: GraphLink[] = []
  while (r.at < r.end) {
    const tag = r.tag()
    if (tag !== 10 && tag !== 18) {
      r.skip(tag)
      continue
    }
    const outer = r.end
    r.end = r.limit()
    if (tag === 10) {
      const n: GraphNode = { id: '' }
      while (r.at < r.end) {
        const field = r.tag()
        switch (field) {
          case 10:
            n.id = r.string(true)
            break
          case 18:
            n.label = r.string()
            break
          case 26:
            n.kind = r.string(true)
            break
          case 37:
            n.x = r.float()
            break
          case 45:
            n.y = r.float()
            break
          case 53:
            n.z = r.float()
            break
          case 58:
            n.art = r.string()
            break
          case 64:
            n.degree = r.uint()
            break
          case 72:
            n.pinned = Boolean(r.uint())
            break
          default:
            r.skip(field)
        }
      }
      nodes.push(n)
    } else {
      const l: GraphLink = { source: '', target: '' }
      while (r.at < r.end) {
        const field = r.tag()
        if (field === 10) l.source = r.string(true)
        else if (field === 18) l.target = r.string(true)
        else if (field === 26) l.kind = r.string(true)
        else r.skip(field)
      }
      links.push(l)
    }
    r.end = outer
  }
  return { nodes, links }
}
