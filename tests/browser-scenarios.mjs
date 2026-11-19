import {
  createGraph,
  ink,
  knowledgeConsole,
  parchment,
  blueprint,
  toBinary,
  fromBinary,
  WebGL2UnavailableError,
} from '../dist/index.js'
import { fixture } from '../demo/fixture.js'
import { attachAnnotations, compileTaxonomies } from '../dist/taxonomy.js'

const raf = () => new Promise(requestAnimationFrame)
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (condition, message) => {
  if (!condition) throw Error(message)
}
async function until(fn, message, timeout = 12000) {
  const end = performance.now() + timeout
  while (!fn()) {
    if (performance.now() > end) throw Error(message)
    await raf()
  }
}
function canvas(w = 360, h = 240) {
  const c = document.createElement('canvas')
  c.style.width = w + 'px'
  c.style.height = h + 'px'
  document.body.append(c)
  return c
}
function read(c) {
  const gl = c.getContext('webgl2'),
    w = gl.drawingBufferWidth,
    h = gl.drawingBufferHeight
  const pixels = new Uint8Array(w * h * 4)
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  return pixels
}
async function nextPixels(c, g) {
  g.resize()
  return new Promise((resolve) => requestAnimationFrame(() => resolve(read(c))))
}
function pointer(c, kind, x, y, id = 1) {
  c.dispatchEvent(
    new PointerEvent(kind, { clientX: x, clientY: y, pointerId: id, button: 0, bubbles: true }),
  )
}
function free(c, g) {
  g.destroy()
  c.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()
  c.remove()
}

export async function lifecycle() {
  const c = canvas(),
    data = {
      nodes: [
        { id: 'left', label: 'Left', x: -30, y: 0 },
        { id: 'right', label: 'Right', x: 30, y: 0 },
      ],
      links: [{ source: 'left', target: 'right' }],
    }
  const g = createGraph(c, data),
    first = g.stats(),
    pixels = read(c)
  let inked = 0
  for (let i = 4; i < pixels.length; i += 4)
    if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1]) inked++
  check(
    first.frames === 1 && first.drawCalls === 2 && first.simTicks === 0 && inked > 100,
    'Frame zero must contain nodes and wires',
  )
  await until(() => g.stats().labels === 2 && !g.stats().pendingFrame, 'Labels or sleep missing')
  const sleep = g.stats(),
    originalRaf = window.requestAnimationFrame
  let idleCallbacks = 0
  window.requestAnimationFrame = (cb) =>
    originalRaf.call(window, (t) => {
      idleCallbacks++
      cb(t)
    })
  await delay(120)
  window.requestAnimationFrame = originalRaf
  const idleFrames = g.stats().frames - sleep.frames,
    idleTicks = g.stats().simTicks - sleep.simTicks
  check(
    idleFrames === 0 && idleTicks === 0 && idleCallbacks === 0 && !g.stats().pendingFrame,
    'Idle work detected',
  )
  let hover, selected, opened
  const off = g.on('hover', (id) => {
    hover = id
  })
  g.on('select', (id) => {
    selected = id
  })
  g.on('open', (id) => {
    opened = id
  })
  pointer(c, 'pointermove', 90, 120)
  pointer(c, 'pointerdown', 90, 120)
  pointer(c, 'pointerup', 90, 120)
  c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  check(
    hover === 'left' && selected === 'left' && opened === 'left',
    'Projected picking, select or Enter failed',
  )
  off()
  pointer(c, 'pointermove', 270, 120)
  check(hover === 'left', 'Unsubscribe failed')
  pointer(c, 'pointerdown', 90, 120)
  pointer(c, 'pointermove', 115, 135)
  pointer(c, 'pointerup', 115, 135)
  await raf()
  pointer(c, 'pointerdown', 115, 135)
  pointer(c, 'pointerup', 115, 135)
  check(selected === 'left', 'Dragged node could not be picked')
  pointer(c, 'pointerdown', 170, 50, 11)
  pointer(c, 'pointerdown', 230, 50, 12)
  pointer(c, 'pointermove', 250, 60, 12)
  pointer(c, 'pointerup', 250, 60, 12)
  pointer(c, 'pointerup', 170, 50, 11)
  g.select('right')
  pointer(c, 'pointerdown', 96, 169)
  pointer(c, 'pointerup', 96, 169)
  check(selected === 'left', 'Pinch did not preserve the moving midpoint')
  g.reset()
  await until(() => !g.stats().pendingFrame, 'Camera did not sleep')
  c.style.position = 'absolute'
  c.style.top = '200vh'
  await delay(180)
  const outside = g.stats().frames
  g.focus('right')
  await delay(120)
  check(g.stats().frames === outside && !g.stats().pendingFrame, 'Offscreen canvas woke')
  g.pause()
  c.style.top = '0'
  await delay(120)
  check(g.stats().frames === outside, 'Visibility overrode pause')
  g.resume()
  await until(() => g.stats().frames > outside, 'Resume failed')
  const gl = c.getContext('webgl2')
  check(gl.getError() === gl.NO_ERROR, 'WebGL error')
  free(c, g)
  check(
    c.getAttribute('tabindex') === null && c.style.touchAction === '',
    'Canvas lifecycle cleanup failed',
  )
  const unsupported = document.createElement('canvas')
  unsupported.getContext('2d')
  try {
    createGraph(unsupported, { nodes: [], links: [] })
    throw Error('Accepted an unavailable context')
  } catch (e) {
    check(e instanceof WebGL2UnavailableError, 'Incorrect capability error')
  }
  return {
    firstSubmitMs: first.firstSubmitMs,
    frameZeroDraws: first.drawCalls,
    inkedPixels: inked,
    idleFrames,
    idleTicks,
    idleCallbacks,
  }
}
function artwork() {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 12
  const ctx = tile.getContext('2d')
  ctx.fillStyle = '#0df83a'
  ctx.fillRect(0, 0, 12, 12)
  return tile.toDataURL()
}
export async function contextAndArt() {
  const c = canvas(),
    g = createGraph(c, {
      nodes: [{ id: 'art', x: 0, y: 0, kind: 'lab', art: artwork(), label: 'Atlas' }],
      links: [],
    })
  const gl = c.getContext('webgl2'),
    ext = gl.getExtension('WEBGL_lose_context')
  check(ext, 'Missing context loss extension')
  async function green() {
    const end = performance.now() + 6000
    do {
      await delay(25)
      const bytes = await nextPixels(c, g),
        i = (Math.floor(c.height / 2) * c.width + Math.floor(c.width / 2)) * 4
      if (bytes[i + 1] > 220 && bytes[i] < 40 && bytes[i + 2] < 90) return true
    } while (performance.now() < end)
    return false
  }
  check(await green(), 'Artwork did not reach the node mask')
  const lost = new Promise((resolve) => c.addEventListener('webglcontextlost', resolve, { once: true }))
  ext.loseContext()
  await lost
  g.pause()
  g.select('art')
  g.setTheme({ ...ink, bg: '#1f2e40', labels: { visibility: 'none' } })
  g.setLayout({ blend: 1, direction: 'vertical' })
  const frozen = g.stats().frames
  await delay(100)
  const restored = new Promise((resolve) =>
    c.addEventListener('webglcontextrestored', resolve, { once: true }),
  )
  ext.restoreContext()
  await restored
  await delay(80)
  check(g.stats().frames === frozen, 'Context restore overrode explicit pause')
  g.resume()
  check(await green(), 'Restored atlas or buffers failed')
  const restoredPixels = await nextPixels(c, g)
  check(
    restoredPixels[0] === 31 &&
      restoredPixels[1] === 46 &&
      restoredPixels[2] === 64 &&
      g.stats().labels === 0,
    'Lost live theme during WebGL restoration',
  )
  check(gl.getError() === gl.NO_ERROR, 'GL context restoration error')
  free(c, g)
  return true
}

export async function worker(expected) {
  const c = canvas(),
    g = createGraph(c, { ...fixture(90), sim: 'worker' })
  g.setMode('orbit')
  g.select('n4')
  await until(() => g.stats().simTicks > 0, 'Worker never returned a tick')
  check(g.stats().transport === expected, 'Expected ' + expected + ' worker, got ' + g.stats().transport)
  g.setMode('lanes')
  g.pause()
  const before = g.stats().frames
  await delay(120)
  check(g.stats().frames === before, 'Worker painted during pause')
  g.resume()
  await until(
    () => !g.stats().pendingFrame && g.stats().simTicks >= 32 && g.stats().frames > before,
    'Worker did not settle',
  )
  await delay(120)
  const settled = g.stats()
  await delay(120)
  check(
    g.stats().frames === settled.frames && g.stats().simTicks === settled.simTicks,
    'Worker failed to stop',
  )
  check(c.getContext('webgl2').getError() === 0, 'Worker upload produced a WebGL error')
  free(c, g)
  return { transport: settled.transport, ticks: settled.simTicks }
}

export async function orbitTransport(transport) {
  const c = canvas(), host = document.createElement('div')
  document.body.append(host)
  const data = { nodes: ['lead', 'left', 'right', 'end', 'pinned'].map((id) => ({ id, kind: 'item',
    ...(id === 'pinned' ? { x: 200, y: 200 } : {}) })),
    links: [['lead', 'left'], ['lead', 'right'], ['left', 'end']].map(([source, target]) => ({ source, target })) }
  const g = createGraph(c, { ...data, sim: transport === 'main' ? 'main' : 'worker', mode: 'orbit',
    layout: { blend: 0.35, orbitGap: 75 } })
  const index = compileTaxonomies(data, { taxonomies: [{ id: 'kind', label: 'Kind', by: 'kind' }] })
  const layer = attachAnnotations(g, host, index, { bubbles: { kind: true }, laneTaxonomy: 'kind' })
  try {
    layer.setOptions({ padding: -1 })
    throw Error('Accepted invalid bubble padding')
  } catch (error) { check(error instanceof RangeError, 'Missing padding validation') }
  await until(() => g.stats().simTicks >= 32 && !g.stats().pendingFrame, 'Blended orbit never settled')
  function distance(a, b) {
    const p = g.getPosition(a), q = g.getPosition(b)
    return Math.hypot(p.x - q.x, p.y - q.y)
  }
  check(g.stats().transport === transport && Math.abs(distance('lead', 'right') - 75) < 15 &&
    distance('lead', 'end') > 124, 'Blended orbit lost its rings on ' + transport)
  const before = g.stats()
  const boundary = host.querySelector('[data-bubble="item"]').getAttribute('d')
  check(boundary.endsWith('Z') && !boundary.includes('NaN'), 'Invalid options damaged the active outline')
  await delay(100)
  check(!g.stats().pendingFrame && before.frames === g.stats().frames, 'Annotations woke a sleeping simulation')
  g.setLayout({ blend: 1 })
  g.select('right')
  check(Math.abs(distance('right', 'end') - 225) < 0.01 && g.getPosition('pinned').x === 200, 'Exact orbit or pin changed on ' + transport)
  g.setMode('lanes')
  await until(() => host.querySelector('[data-lane="item"]'), 'Lane captions did not appear')
  free(c, g)
  check(!host.childElementCount, 'Destroy should release the annotation DOM')
  host.remove()
  return { transport, ticks: before.simTicks }
}

export async function golden() {
  const out = document.createElement('canvas')
  out.width = 640
  out.height = 300
  const target = out.getContext('2d')
  let row = 0
  for (const theme of [parchment, ink, blueprint]) {
    let col = 0
    for (const mode of ['drift', 'lanes', 'orbit', 'cloud']) {
      const c = canvas(320, 200),
        data = fixture(15, false, 2)
      data.nodes[2].art = artwork()
      const g = createGraph(c, { ...data, mode, theme: { ...theme, font: 'monospace' }, sim: 'main' })
      if (mode === 'orbit') g.select('n4')
      await until(
        () => g.stats().simTicks >= 32 && !g.stats().pendingFrame,
        'Golden layout did not settle',
      )
      await delay(40)
      const pixels = await nextPixels(c, g),
        image = new ImageData(c.width, c.height),
        stride = c.width * 4
      for (let y = 0; y < c.height; y++)
        image.data.set(pixels.subarray(y * stride, (y + 1) * stride), (c.height - y - 1) * stride)
      const tile = document.createElement('canvas')
      tile.width = c.width
      tile.height = c.height
      tile.getContext('2d').putImageData(image, 0, 0)
      target.drawImage(tile, col++ * 160, row * 100, 160, 100)
      free(c, g)
    }
    row++
  }
  return out.toDataURL().split(',')[1]
}
export async function compareGolden(actual, expected) {
  async function bytes(encoded) {
    const img = new Image()
    img.src = 'data:image/png;base64,' + encoded
    await img.decode()
    const board = document.createElement('canvas')
    board.width = img.width
    board.height = img.height
    const ctx = board.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, img.width, img.height).data
  }
  const a = await bytes(actual),
    b = await bytes(expected)
  check(a.length === b.length, 'Golden dimensions changed')
  const errors = []
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++) {
      let sum = 0,
        large = 0
      for (let y = row * 100; y < (row + 1) * 100; y++)
        for (let x = col * 160; x < (col + 1) * 160; x++) {
          const i = (y * 640 + x) * 4,
            d =
              (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3
          sum += d
          if (d > 28) large++
        }
      const mean = sum / 16000,
        fraction = large / 16000
      check(
        mean < 4 && fraction < 0.055,
        'Golden mismatch at theme ' +
          row +
          ', mode ' +
          col +
          ': ' +
          mean.toFixed(2) +
          ' mean / ' +
          fraction.toFixed(3) +
          ' large',
      )
      errors.push(+mean.toFixed(2))
    }
  return errors
}

// This document has no text or images. Its WebGL canvas is its only FCP candidate.
export async function startup() {
  const data = fixture(1000),
    c = document.createElement('canvas')
  c.style.cssText = 'width:960px;height:640px'
  await raf()
  document.body.append(c)
  const start = performance.now(),
    g = createGraph(c, data),
    returned = performance.now() - start
  await until(
    () => performance.getEntriesByName('first-contentful-paint').length > 0,
    'Browser reported no graph presentation',
    6000,
  )
  const entry = performance.getEntriesByName('first-contentful-paint')[0]
  check(entry.startTime >= start, 'FCP predates graph creation')
  const gl = c.getContext('webgl2'),
    ext = gl.getExtension('WEBGL_debug_renderer_info')
  const metrics = {
    submit: g.stats().firstSubmitMs,
    returned,
    paint: entry.paintTime ? entry.paintTime - start : null,
    present: (entry.presentationTime || entry.startTime) - start,
    gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
  }
  free(c, g)
  return metrics
}
export async function throughput(n, frames = 72, styled = false) {
  const c = canvas(960, 640),
    data = fixture(n, true)
  if (styled) {
    const kinds = ['tag', 'concept', 'category']
    data.links.forEach((link, index) => {
      link.kind = kinds[index % kinds.length]
    })
  }
  const g = createGraph(c, {
    ...data,
    theme: styled ? knowledgeConsole : ink,
    layout: styled ? { blend: 0.55, guides: true } : undefined,
  })
  await until(() => !g.stats().pendingFrame && g.stats().labels > 0, 'Graph did not warm')
  const times = [],
    fences = []
  const gl = c.getContext('webgl2')
  let startFrames = 0,
    completed = 0,
    observed = 0
  for (let i = 0; i < frames + 12; i++) {
    const time = await raf()
    const drawn = g.stats().frames
    if (i === 11) {
      startFrames = drawn
      observed = drawn
    }
    if (i >= 11) times.push(time)
    if (i > 11 && drawn > observed) {
      fences.push(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0))
      gl.flush()
      observed = drawn
    }
    while (fences.length && gl.getSyncParameter(fences[0], gl.SYNC_STATUS) === gl.SIGNALED) {
      gl.deleteSync(fences.shift())
      completed++
    }
    c.dispatchEvent(new KeyboardEvent('keydown', { key: (i >> 2) & 1 ? 'ArrowLeft' : 'ArrowRight' }))
  }
  const elapsed = times.at(-1) - times[0],
    deltas = times
      .slice(1)
      .map((t, i) => t - times[i])
      .sort((a, b) => a - b)
  const s = g.stats(),
    submitted = s.frames - startFrames
  // Include GPU drain for the measured frames; each fence is checked nonblocking.
  g.pause()
  const drainStart = performance.now()
  while (fences.length) {
    while (fences.length && gl.getSyncParameter(fences[0], gl.SYNC_STATUS) === gl.SIGNALED) {
      gl.deleteSync(fences.shift())
      completed++
    }
    if (performance.now() - drainStart > 5000) throw Error('GPU fence did not signal')
    if (fences.length) await delay(0)
  }
  const drainMs = performance.now() - drainStart
  free(c, g)
  return {
    nodes: n,
    links: n * 4,
    fps: (1000 * completed) / (elapsed + drainMs),
    submitted,
    completed,
    p95FrameMs: deltas[Math.ceil(deltas.length * 0.95) - 1],
    drawCalls: s.drawCalls,
    dpr: s.dpr,
    labels: s.labels,
  }
}
export function codecs() {
  const data = fixture(25000, true),
    json = JSON.stringify(data),
    binary = toBinary(data)
  const t = performance.now()
  const a = fromBinary(binary)
  const protoMs = performance.now() - t
  const t2 = performance.now()
  const b = JSON.parse(json)
  const jsonMs = performance.now() - t2
  check(
    a.nodes.length === b.nodes.length && a.links.length === b.links.length,
    'Benchmark decoded the wrong graph',
  )
  return {
    nodes: a.nodes.length,
    links: a.links.length,
    protoMs,
    jsonMs,
    protoBytes: binary.length,
    jsonBytes: json.length,
  }
}

export async function inputSetup() {
  const c = canvas(960, 640),
    g = createGraph(c, { ...fixture(5000), sim: 'main' })
  c.focus()
  const times = []
  c.addEventListener('keydown', (e) => {
    if (e.isTrusted && g.stats().simTicks < 32) times.push(performance.now() - e.timeStamp)
  })
  globalThis.inputResults = () => ({
    maxMs: Math.max(...times),
    samples: times.length,
    ticks: g.stats().simTicks,
  })
  await until(() => g.stats().simTicks >= 1, 'Input test did not begin settling')
}
export function memoryCase() {
  const c = canvas(960, 640),
    data = fixture(25000)
  data.nodes[0].art = artwork()
  // Keep the graph reachable while CDP collects live heap and backing-store usage.
  const g = createGraph(c, { ...data, sim: 'main' })
  globalThis.memoryGraph = g
  return until(
    () => g.stats().labels > 0 && g.stats().simTicks >= 1,
    'Memory graph failed to initialise',
    30000,
  )
}
// Instrument allocations in the benchmark page only; the library has no telemetry loop.
export function trackGpu() {
  const proto = WebGL2RenderingContext.prototype
  let buffers = 0,
    textures = 0
  const bufferData = proto.bufferData,
    texImage = proto.texImage2D
  proto.bufferData = function (target, data, ...rest) {
    buffers += typeof data === 'number' ? data : data.byteLength
    return bufferData.call(this, target, data, ...rest)
  }
  proto.texImage2D = function (...args) {
    if (typeof args[3] === 'number' && args.length >= 9)
      textures += args[3] * args[4] * (args[2] === this.RGBA32F ? 16 : 4)
    return texImage.apply(this, args)
  }
  globalThis.loomGpuBytes = () => {
    const c = document.querySelector('canvas'),
      gl = c.getContext('webgl2')
    // RGBA8 colour and 32-bit depth, single sample. Browser swapchain/driver overhead is opaque.
    return { buffers, textures, framebuffer: gl.drawingBufferWidth * gl.drawingBufferHeight * 8 }
  }
}

export async function settlement() {
  const c = canvas(960, 640),
    data = fixture(1000),
    start = performance.now()
  const g = createGraph(c, { ...data, sim: 'main' })
  const frameZeroTicks = g.stats().simTicks
  await until(() => g.stats().simTicks >= 32 && !g.stats().pendingFrame, 'Main layout never settled')
  const result = { frameZeroTicks, ticks: g.stats().simTicks, settledMs: performance.now() - start }
  free(c, g)
  return result
}
export async function evaluation() {
  const source = await (await fetch('/dist/index.js')).text()
  const url = URL.createObjectURL(
    new Blob(
      [
        'const __loomStart=performance.now();\n',
        source,
        '\nglobalThis.__loomEvaluationMs=performance.now()-__loomStart',
      ],
      { type: 'text/javascript' },
    ),
  )
  const start = performance.now()
  try {
    await import(url)
    return { evaluationMs: globalThis.__loomEvaluationMs, moduleLoadMs: performance.now() - start }
  } finally {
    URL.revokeObjectURL(url)
    delete globalThis.__loomEvaluationMs
  }
}

// Calibrate the compositor path with the same canvas as the startup gate.
export async function clearOnly() {
  const c = document.createElement('canvas')
  c.width = 960
  c.height = 640
  c.style.cssText = 'width:960px;height:640px'
  await raf()
  document.body.append(c)
  const start = performance.now()
  const gl = c.getContext('webgl2', { alpha: false, antialias: false, depth: true, stencil: false })
  gl.clearColor(0.1, 0.2, 0.3, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.flush()
  const submit = performance.now() - start
  await until(
    () => performance.getEntriesByName('first-contentful-paint').length > 0,
    'No calibration presentation',
    6000,
  )
  const entry = performance.getEntriesByName('first-contentful-paint')[0]
  check(entry.startTime >= start, 'Calibration FCP predates canvas creation')
  const present = (entry.presentationTime || entry.startTime) - start
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  c.remove()
  return { submit, present }
}

export async function hybrid(expected = 'main') {
  const { knowledgeConsole } = await import('../dist/index.js')
  const { mountConsoleGraph } = await import('../dist/console.js')
  const c = canvas(480, 300)
  c.style.setProperty('--kg-concept', 'rgb(245, 230, 70)')
  const { readConsoleTheme } = await import('../dist/console.js')
  const theme = readConsoleTheme(c)
  check(theme.kind.concept === '#f5e646', 'Host palette was not resolved')
  let anchorCalls = 0
  const nodes = [
    { id: 'a', kind: 'concept', label: 'A' },
    { id: 'b', kind: 'lab', label: 'B' },
    { id: 'c', kind: 'lab', label: 'C', x: 0, y: 44 },
  ]
  const anchor = (node) => {
    anchorCalls++
    return node.id === 'a' ? { x: -60, y: 0 } : { x: 60, y: 0 }
  }
  const g = mountConsoleGraph(
    c,
    {
      nodes,
      edges: [
        { source: 'a', target: 'b', kind: 'concept' },
        { source: 'a', target: 'c', kind: 'tag' },
      ],
    },
    true,
    () => {
      throw Error('Unexpected legacy path')
    },
    {
      sim: expected === 'main' ? 'main' : 'worker',
      layout: { blend: 1, anchor },
      theme,
      reducedMotion: 'respect',
    },
  )
  try {
    const pos = (id) => g.getPosition(id),
      near = (a, b) => Math.abs(a - b) < 0.01
    check(
      near(pos('a').x, -60) && near(pos('b').x, 60) && pos('c').pinned,
      'Authored targets or original pin failed',
    )
    await until(() => g.stats().labels > 0 && !g.stats().pendingFrame, 'Fixed diagram failed to sleep')
    check(g.stats().simTicks === 0, 'Full structure used physics')
    g.setLayout({ blend: 0.45 })
    await until(
      () => g.stats().simTicks >= 32 && !g.stats().pendingFrame,
      'Hybrid simulation failed to settle',
    )
    check(g.stats().transport === expected && anchorCalls === 3, 'Transport or cached targets failed')
    check(
      !near(pos('a').x, -60) && !near(pos('b').x, 60) && pos('c').y === 44,
      'Mixed positions or pin incorrect',
    )
    const selected = []
    g.on('select', (id) => selected.push(id))
    g.select('a')
    const ticks = g.stats().simTicks,
      before = pos('a')
    const basePixels = await nextPixels(c, g)
    const custom = {
      ...theme,
      bg: '#192032',
      nodes: {
        ...theme.nodes,
        byKind: { ...theme.nodes.byKind, lab: { color: '#ff8833', shape: 'circle' } },
      },
      wires: { routing: 'straight', width: 3, opacity: 0.7 },
      labels: { visibility: 'none' },
    }
    g.setTheme(custom)
    const changed = await nextPixels(c, g)
    check(
      changed[0] === 25 && changed[1] === 32 && changed[2] === 50 && changed[0] !== basePixels[0],
      'Live background failed',
    )
    check(
      g.stats().labels === 0 &&
        g.stats().simTicks === ticks &&
        near(pos('a').x, before.x) &&
        selected.length === 1,
      'Restyle lost state or ran physics',
    )
    g.pin('a', { x: -75, y: 17, z: 3 })
    g.setLayout({ blend: 1 })
    check(
      pos('a').pinned && pos('a').x === -75 && pos('a').z === 3 && pos('b').x === 60,
      'Manual pin precedence failed',
    )
    g.unpin('a')
    check(
      !pos('a').pinned && pos('a').x === -60 && pos('a').z === 0,
      'Unpin did not restore diagram anchor',
    )
    g.setTheme({
      ...knowledgeConsole,
      nodes: { scale: 2, byKind: { concept: { radius: 18, shape: 'square' } } },
    })
    g.setLayout({ blend: 0.3 })
    g.setLayout({
      blend: 1,
      anchor: null,
      laneGap: 120,
      rowGap: 32,
      direction: 'vertical',
      guides: true,
    })
    g.pause()
    await delay(40)
    g.resume()
    await nextPixels(c, g)
    await delay(80)
    check(
      pos('a').y === -60 && pos('b').y === 60 && pos('c').y === 44,
      'Stale worker frame overwrote a new diagram',
    )
    check(
      g.stats().labels > 0 && c.getContext('webgl2').getError() === 0,
      'Re-enabled labels or GL state failed',
    )
    return { transport: expected, anchorCalls, ticks, drawCalls: g.stats().drawCalls }
  } finally {
    free(c, g)
  }
}

export async function styledGeometry() {
  const c = canvas(400, 280)
  const base = {
    ...ink,
    bg: '#000',
    bezel: '#000',
    nodes: { fill: 1, byKind: { task: { color: '#0000ff', radius: 12, shape: 'circle' } } },
    wires: { routing: 'patch', byKind: { signal: { color: '#ff0000', width: 4, opacity: 1 } } },
  }
  const g = createGraph(c, {
    nodes: [
      { id: 'a', kind: 'task', x: -48, y: -28 },
      { id: 'b', kind: 'task', x: 48, y: 28 },
    ],
    links: [{ source: 'a', target: 'b', kind: 'signal' }],
    theme: base,
  })
  function mask(p, channel) {
    return Uint8Array.from({ length: p.length / 4 }, (_, i) =>
      Number(
        p[i * 4 + channel] > 190 &&
          p[i * 4 + ((channel + 1) % 3)] < 40 &&
          p[i * 4 + ((channel + 2) % 3)] < 40,
      ),
    )
  }
  const count = (pixels) => pixels.reduce((sum, bit) => sum + bit, 0)
  const diff = (a, b) => a.reduce((sum, bit, i) => sum + Number(bit !== b[i]), 0)
  try {
    const initial = await nextPixels(c, g),
      horiz = mask(initial, 0),
      circle = mask(initial, 2)
    g.setLayout({ direction: 'vertical' })
    const vert = mask(await nextPixels(c, g), 0)
    g.setTheme({ ...base, wires: { ...base.wires, routing: 'straight' } })
    const straight = mask(await nextPixels(c, g), 0)
    g.setTheme({ ...base, wires: { ...base.wires, routing: 'arc' } })
    const arc = mask(await nextPixels(c, g), 0)
    check(
      count(horiz) > 100 &&
        diff(horiz, vert) > 300 &&
        diff(horiz, straight) > 300 &&
        diff(arc, straight) > 300,
      'Patch, rotated patch, line or arc geometry failed',
    )
    const squareTheme = {
      ...base,
      nodes: { fill: 1, byKind: { task: { color: '#0000ff', radius: 12, shape: 'square' } } },
      wires: { ...base.wires, resolve: () => ({ color: '#00ff00', width: 6 }) },
    }
    g.setTheme(squareTheme)
    const edited = await nextPixels(c, g),
      green = count(mask(edited, 1))
    check(
      green > count(horiz) &&
        count(mask(edited, 0)) === 0 &&
        count(mask(edited, 2)) > count(circle) * 1.15,
      'Live wire override or square marker failed',
    )
    g.setTheme({ ...squareTheme, wires: { ...squareTheme.wires, resolve: () => ({ opacity: 0 }) } })
    const hidden = await nextPixels(c, g)
    check(
      count(mask(hidden, 0)) === 0 &&
        count(mask(hidden, 1)) === 0 &&
        g.stats().simTicks === 0 &&
        g.stats().drawCalls === 2,
      'Zero-opacity fixed diagram failed',
    )
    return {
      horizontalPatch: count(horiz),
      verticalPatch: count(vert),
      straight: count(straight),
      arc: count(arc),
      overriddenWire: green,
    }
  } finally {
    free(c, g)
  }
}

export async function dragPin() {
  const c = canvas(360, 240)
  const g = createGraph(c, { nodes: [{ id: 'a' }], links: [], layout: { blend: 1, pinOnDrag: true } })
  try {
    await until(() => !g.stats().pendingFrame, 'Fixed node never slept')
    function drag(endEvent) {
      pointer(c, 'pointerdown', 180, 120)
      pointer(c, 'pointermove', 210, 135)
      pointer(c, endEvent, 210, 135)
      return g.getPosition('a')
    }
    const kept = drag('pointerup')
    check(kept.pinned && kept.x === 10 && kept.y === 5, 'Drag pin did not retain the node')
    g.unpin('a')
    await nextPixels(c, g)
    const cancelled = drag('pointercancel')
    check(!cancelled.pinned && cancelled.x === 0, 'Cancelled drag pinned a node')
    await nextPixels(c, g)
    g.setLayout({ pinOnDrag: false })
    const released = drag('pointerup')
    check(
      !released.pinned && released.x === 0 && g.stats().simTicks === 0,
      'Temporary drag failed to return to its anchor',
    )
    return true
  } finally {
    free(c, g)
  }
}

export async function springDrag(expected = 'main', reduced = false) {
  const c = canvas(620, 360)
  const g = createGraph(c, {
    nodes: [
      { id: 'grab', label: 'Grab this node by its label', x: 0, y: 0, pinned: false },
      { id: 'peer', x: -110, y: 0, pinned: false },
      { id: 'post', x: -125, y: 68 },
    ],
    links: [{ source: 'grab', target: 'peer', kind: 'concept' }],
    layout: {
      blend: 0.25,
      linkDistance: 48,
      anchor: (n) => (n.id === 'grab' ? { x: 0, y: 0 } : { x: -110, y: 0 }),
    },
    sim: expected === 'main' ? 'main' : 'worker',
    reducedMotion: reduced ? 'respect' : 'ignore',
  })
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
  try {
    check(
      g.getPosition('grab').x === 0 && g.getPosition('peer').x === -110,
      'Frame zero displaced a supplied movable seed',
    )
    g.select('grab')
    await until(
      () => g.stats().simTicks >= 32 && !g.stats().pendingFrame,
      'Seeded graph failed to settle',
    )
    if (!reduced) check(g.stats().frames >= 5, 'Small graph settled in a single paint')
    g.focus('grab')
    await until(() => !g.stats().pendingFrame, 'Focus failed')
    const start = g.getPosition('grab'),
      peer = g.getPosition('peer'),
      post = g.getPosition('post')
    const report = { transport: g.stats().transport, heldSamples: 0, releaseSamples: 0, peerTravel: 0 }
    check(report.transport === expected, 'Wrong drag transport')
    // The pointer starts on the label, clear of the marker. Every sample arrives
    // while workers can still be computing the previous spring response.
    const x = 360,
      y = 180,
      travel = 125
    pointer(c, 'pointerdown', x, y)
    let previous = peer,
      lastGrab = start
    for (let i = 1; i <= 25; i++) {
      pointer(c, 'pointermove', x + i * 5, y)
      const local = g.getPosition('grab')
      check(local.pinned && local.x > lastGrab.x, 'Missed the label or snapped behind the pointer')
      lastGrab = local
      await raf()
      check(distance(g.getPosition('grab'), local) < 0.01, 'A worker snapshot moved the held node')
      const p = g.getPosition('peer')
      if (distance(p, previous) > 0.02) report.heldSamples++
      report.peerTravel = Math.max(report.peerTravel, distance(peer, p))
      previous = p
    }
    check(
      report.heldSamples >= 3 && report.peerTravel > distance(start, lastGrab) * 0.12,
      'Connected node failed to respond during the drag',
    )
    const ticks = g.stats().simTicks
    pointer(c, 'pointerup', x + travel, y)
    check(!g.getPosition('grab').pinned, 'Release left a permanent pin')
    previous = g.getPosition('grab')
    for (let i = 0; i < 20; i++) {
      await raf()
      const p = g.getPosition('grab')
      if (distance(p, previous) > 0.02) report.releaseSamples++
      previous = p
    }
    if (!reduced) check(report.releaseSamples >= 3, 'Release collapsed into a single paint')
    await until(
      () => g.stats().simTicks >= ticks + 29 && !g.stats().pendingFrame,
      'Released graph failed to cool',
    )
    await delay(100)
    const rested = g.stats()
    await delay(100)
    check(
      rested.frames === g.stats().frames &&
        rested.simTicks === g.stats().simTicks &&
        !g.stats().pendingFrame,
      'Released graph continued idle work',
    )
    check(
      distance(g.getPosition('post'), post) === 0 && g.getPosition('post').pinned,
      'Existing pin drifted',
    )
    check(distance(g.getPosition('grab'), lastGrab) > 1, 'Released node did not respond to forces')
    return report
  } finally {
    free(c, g)
  }
}

export async function cloudDrag() {
  const c = canvas(560, 320)
  const g = createGraph(c, {
    mode: 'cloud',
    nodes: [
      { id: 'grab', x: 0, y: 0, z: 4 },
      { id: 'post', x: -80, y: 20, z: 70 },
    ],
    links: [{ source: 'grab', target: 'post' }],
  })
  try {
    await raf()
    pointer(c, 'pointerdown', 15, 15)
    pointer(c, 'pointermove', 100, 55)
    pointer(c, 'pointerup', 100, 55)
    g.focus('grab')
    await until(() => !g.stats().pendingFrame, 'Cloud focus failed')
    const start = g.getPosition('grab'),
      post = g.getPosition('post')
    pointer(c, 'pointerdown', 280, 160)
    pointer(c, 'pointermove', 350, 180)
    const end = g.getPosition('grab')
    pointer(c, 'pointerup', 350, 180)
    check(
      end.x !== start.x && end.y !== start.y && end.z !== start.z && end.pinned,
      'Dragging a cloud node rotated the scene',
    )
    let target
    g.on('hover', (id) => {
      target = id
    })
    pointer(c, 'pointermove', 350, 180)
    check(
      target === 'grab' && g.getPosition('post').x === post.x,
      'Cloud node left the pointer or moved a pinned neighbour',
    )
    return true
  } finally {
    free(c, g)
  }
}
