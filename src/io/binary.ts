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
  string(tag: number, value?: string, preserveEmpty = false) {
    if (value === undefined || (!value && !preserveEmpty)) return
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
  integer(tag: number, value: number | undefined) {
    if (value === undefined) return
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError('Expected uint32')
    this.room(6)
    this.bytes[this.at++] = tag
    this.uint(value)
  }
  double(tag: number, value: number | undefined) {
    if (value === undefined) return
    if (!Number.isFinite(value)) throw new RangeError('Expected finite metric')
    this.room(9)
    this.bytes[this.at++] = tag
    this.view.setFloat64(this.at, value, true)
    this.at += 8
  }
  metrics(tag: number, values?: Readonly<Record<string, number>>) {
    if (!values) return
    for (const [key, value] of Object.entries(values)) {
      const entry = this.message(tag)
      this.string(10, key)
      this.double(17, value)
      this.finish(entry)
    }
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
    w.integer(64, n.degree)
    if (n.pinned !== undefined) {
      w.room(2)
      w.bytes[w.at++] = 72
      w.bytes[w.at++] = pinFlag(n.pinned)
    }
    w.string(82, n.section, true)
    w.integer(88, n.contentSize)
    w.double(97, n.complexity)
    w.metrics(106, n.metrics)
    w.string(114, n.summary, true)
    w.string(122, n.content, true)
    w.finish(start)
  }
  for (const l of data.links) {
    const start = w.message(18)
    w.string(10, l.source)
    w.string(18, l.target)
    w.string(26, l.kind)
    w.double(33, l.weight)
    w.metrics(42, l.metrics)
    w.string(50, l.id, true)
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
  #shortStrings = new Map<number, string>()
  #strings = new Map<number, { start: number; length: number; text: string }>()
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
      const hit = this.#shortStrings.get(hash)
      if (hit !== undefined) return hit
    } else if (intern) {
      for (let i = start; i < end; i++) hash = Math.imul(hash ^ b[i], 16777619)
      const hit = this.#strings.get(hash)
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
    if (short) this.#shortStrings.set(hash, text)
    else if (intern) this.#strings.set(hash, { start, length, text })
    return text
  }
  float() {
    if (this.at + 4 > this.end) invalid()
    const n = this.view.getFloat32(this.at, true)
    this.at += 4
    return n
  }
  double() {
    if (this.at + 8 > this.end) return invalid()
    const n = this.view.getFloat64(this.at, true)
    this.at += 8
    if (!Number.isFinite(n)) return invalid()
    return n
  }
  metric(record: GraphNode | GraphLink) {
    const outer = this.end
    this.end = this.limit()
    let key = '', value = 0
    while (this.at < this.end) {
      const tag = this.tag()
      if (tag === 10) key = this.string(true)
      else if (tag === 17) value = this.double()
      else this.skip(tag)
    }
    this.end = outer
    Object.defineProperty(record.metrics ??= {}, key, { value, enumerable: true, configurable: true, writable: true })
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
          case 82: n.section = r.string(true); break
          case 88: n.contentSize = r.uint(); break
          case 97: n.complexity = r.double(); break
          case 106: r.metric(n); break
          case 114: n.summary = r.string(); break
          case 122: n.content = r.string(); break
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
        else if (field === 33) l.weight = r.double()
        else if (field === 42) r.metric(l)
        else if (field === 50) l.id = r.string(true)
        else r.skip(field)
      }
      links.push(l)
    }
    r.end = outer
  }
  return { nodes, links }
}
