import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import './build.mjs'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const [html, css, picker, worker] = await Promise.all([
  read('../demo/index.html'),
  read('../demo/studio.css'),
  read('../demo/graph-picker.css'),
  read('../dist/layout-worker.js'),
])
const { outputFiles } = await build({
  entryPoints: ['demo/studio.js'],
  bundle: true,
  write: false,
  minify: true,
  format: 'esm',
  target: 'es2022',
})
const script = (text) => text.replace(/<\/script/gi, '<\\/script')
const result = html
  .replace('<link rel="stylesheet" href="./graph-picker.css" />', () => '<style>' + picker + '</style>')
  .replace(
    /<link\s+rel="stylesheet"\s+href="\.\/studio\.css"\s*\/?>/,
    () => '<style>' + css + '</style>',
  )
  .replace(
    /<script type="module" src="\.\/studio\.js"><\/script>/,
    () =>
      '<script id="layout-worker" type="text/plain">' +
      script(worker) +
      '</script>\n<script type="module">' +
      script(outputFiles[0].text) +
      '</script>',
  )
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true })
await writeFile(new URL('../artifacts/loom-studio.html', import.meta.url), result)
