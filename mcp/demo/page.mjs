import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

export async function demoAssets() {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('./client.jsx', import.meta.url))], outfile: 'client.js',
    nodePaths: [fileURLToPath(new URL('../../web/node_modules', import.meta.url))],
    bundle: true, write: false, jsx: 'automatic', format: 'esm', minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const assets = new Map(bundle.outputFiles.map(file => [file.path.endsWith('.css') ? 'client.css' : 'client.js', file.contents]))
  assets.set('index.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Loom · Live MCP connection</title><link rel="stylesheet" href="./client.css"><main id="demo"></main><script type="module" src="./client.js"></script></html>')
  return assets
}
