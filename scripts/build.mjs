import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { minify } from 'terser'

// WebGL enum values are fixed by the API. Inline TypeScript's platform constants
// in the renderer while keeping the named enums in the source.
const dom = await readFile(new URL(import.meta.resolve('typescript/lib/lib.dom.d.ts')), 'utf8')
const enums = new Map([...dom.matchAll(/readonly ([A-Z][A-Z0-9_]+): (0x[\da-fA-F]+);/g)].map(([, key, hex]) => [key, String(Number(hex))]))
const glEnums = { name: 'webgl-enums', setup(plugin) {
  plugin.onLoad({ filter: /[/\\]render[/\\](?:renderer|gl|labels|art)\.ts$/ }, async ({ path }) => ({
    loader: 'ts', contents: (await readFile(path, 'utf8')).replace(/\b(?:this\.)?gl\.([A-Z][A-Z0-9_]+)\b/g, (source, name) => enums.get(name) ?? source),
  }))
} }

// Compress embedded GLSL at build time. Uniform-block fields are addressed by
// offset in the renderer. Keep standalone uniforms and preprocessor lines intact.
const shaders = {
  name: 'embedded-glsl',
  setup(plugin) {
    plugin.onLoad({ filter: /[/\\]render[/\\]shaders\.ts$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8')
      const block = /uniform Scene\s*\{\s*vec4 ([^;]+);/.exec(source)[1].split(',').map((s) => s.trim())
      // Reserve uppercase names so local variables such as v0 cannot collide.
      const short = (i) => i < 26 ? String.fromCharCode(65 + i) : 'Z' + (i - 26).toString(36)
      const names = new Map(block.map((field, i) => [field, short(i)]))
      // Attributes have explicit locations and varyings link by name between stages.
      const internal = ['projectNode', 'nodeAt', 'corner', 'pigment', 'details', 'eyeDepth', 'neighbor',
        'ringWidth', 'artIndex', 'wireWidth', 'wireColor', 'tangent', 'normal', 'spacing', 'selected',
        'hovered', 'segments', 'density', 'bezel', 'accent', 'origin', 'local', 'curve', 'depth',
        'scale', 'side', 'along', 'stroke', 'pattern', 'width', 'alpha', 'phase', 'delta', 'light',
        'world', 'clip', 'mid', 'bend', 'unit', 'axis', 'far', 'head', 'slot', 'cell', 'edge', 'color', 'dash', 'shaft',
        'guide', 'index', 'dots', 'styled', 'period', 'coverage', 'hot', 'halo', 'stripe', 'lines', 'handle', 'wobble']
      internal.forEach((name, index) => names.set(name, short(block.length + index)))
      const contents = source.replace(/`([^`]+)`/g, (_, shader) => {
        const compact = shader.replace(/\/\/[^\n]*/g, '').trim().replace(/\b\w+\b/g, (word) => names.get(word) ?? word)
          .split(/^\s*(#[^\n]*)$/gm)
          .map((part) => part.startsWith('#') ? '\n' + part.trim() + '\n' :
            part.replace(/\s+/g, ' ').replace(/\s*([(),;{}=*\/<>])\s*/g, '$1')
              .replace(/\b(\d+)\.0\b/g, '$1.').replace(/\b0\.(\d+)/g, '.$1').trim()).join('')
        return '`\n' + compact + '\n`'
      })
      return { contents, loader: 'ts' }
    })
  },
}
const options = {
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  plugins: [shaders, glEnums],
}
const core = await build({ ...options, write: false, entryPoints: { index: 'src/index.ts', 'layout-worker': 'src/sim/worker.ts' } })
await mkdir(options.outdir, { recursive: true })
// These methods and fields are internal to a single compiled renderer or worker.
// Keep public options, user records, GPU names and posted message keys intact.
const internals = /^(?:targetZoom|resetAngle|zoomAt|unproject|project|basis|focal|pan|rotate|pick|pickLabel|labelCount|projected|rebuild|draggingNode|held|reduced|startX|startY|advance|configure|settling|needsFrame|wake|suspend|pending|maximum|paint|uniformBlock|vao|attribute|texture|upload|place|repel|insert|items|res|ready|actions|camera|model|neighborhood|byId|laneMap|offsets|movable|room|uint|finish|string|float|integer|double|limit|metric|skip|bytes|program|check|draws|wireColors|wireWidths|look|tx|ty|tz)$/
await Promise.all(core.outputFiles.map(async (file) => {
  const result = await minify(file.text, { ecma: 2022, module: true, compress: { passes: 3 }, mangle: { properties: { regex: internals } } })
  await writeFile(file.path, result.code)
}))
await build({ ...options, entryPoints: ['src/console.ts', 'src/wires.ts'], external: ['./index.js'] })
await build({ ...options, entryPoints: ['src/taxonomy.ts'] })
await build({ ...options, entryPoints: ['src/performance.ts', 'src/clusters.ts', 'src/metrics.ts', 'src/drilldown.ts', 'src/editor.ts', 'src/explore.ts'] })
const { editorSchema } = await import('../dist/editor.js')
await writeFile('dist/editor.schema.json', JSON.stringify(editorSchema, null, 2) + '\n')
const { wireEffectsSchema, drawingStyleSchema } = await import('../dist/wires.js')
await writeFile('dist/wire-effects.schema.json', JSON.stringify(wireEffectsSchema, null, 2) + '\n')
await writeFile('dist/drawing-style.schema.json', JSON.stringify(drawingStyleSchema, null, 2) + '\n')
