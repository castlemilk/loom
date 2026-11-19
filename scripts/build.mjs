import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'

// Compress embedded GLSL at build time. Uniform-block fields are addressed by
// offset in the renderer. Keep standalone uniforms and preprocessor lines intact.
const shaders = {
  name: 'embedded-glsl',
  setup(plugin) {
    plugin.onLoad({ filter: /[/\\]render[/\\]shaders\.ts$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8')
      const block = /uniform Scene\s*\{\s*vec4 ([^;]+);/.exec(source)[1].split(',').map((s) => s.trim())
      const names = new Map(block.map((field, i) => [field, 'u' + i]))
      // Attributes have explicit locations and varyings link by name between stages.
      const internal = ['projectNode', 'nodeAt', 'corner', 'pigment', 'details', 'eyeDepth', 'neighbor',
        'ringWidth', 'artIndex', 'wireWidth', 'wireColor', 'tangent', 'normal', 'spacing', 'selected',
        'hovered', 'segments', 'density', 'bezel', 'accent', 'origin', 'local']
      internal.forEach((name, index) => names.set(name, 'v' + index.toString(36)))
      const contents = source.replace(/`([^`]+)`/g, (_, shader) => {
        const compact = shader.trim().replace(/\b\w+\b/g, (word) => names.get(word) ?? word)
          .split(/^\s*(#[^\n]*)$/gm)
          .map((part) => part.startsWith('#') ? '\n' + part.trim() + '\n' :
            part.replace(/\s+/g, ' ').replace(/\s*([(),;{}=*\/<>])\s*/g, '$1').trim()).join('')
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
  plugins: [shaders],
}
await build({ ...options, entryPoints: { index: 'src/index.ts', 'layout-worker': 'src/sim/worker.ts' } })
await build({ ...options, entryPoints: ['src/console.ts'], external: ['./index.js'] })
await build({ ...options, entryPoints: ['src/taxonomy.ts'] })
await build({ ...options, entryPoints: ['src/performance.ts'] })
