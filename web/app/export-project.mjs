export const projectCommands = 'npm install\nnpm run dev'

export function mountCode(language) {
  const ts = language === 'ts'
  return `import { mountScene${ts ? ', type GraphScene' : ''} } from 'loom-core/scene'

export async function mountGraph(canvas${ts ? ': HTMLCanvasElement' : ''}, workerURL${ts ? '?: string' : ''}) {
  const response = await fetch(new URL('./scene.json', import.meta.url))
  if (!response.ok) throw new Error('Could not load scene.json (' + response.status + ')')
  const scene${ts ? ': GraphScene' : ''} = await response.json()
  const graph = mountScene(canvas, scene, { workerURL })
  graph.on('open', id => graph.focus(id))
  return graph
}`
}

export function fileStem(name) {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || 'loom-graph'
}

function projectHTML(name, language) {
  const title = name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box }
    body { margin: 0; height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr); font: 15px/1.4 system-ui, sans-serif; color: #293229; background: #faf9f3 }
    header { display: flex; align-items: center; gap: 1rem; padding: .75rem 1rem; border-bottom: 1px solid #d3d5cb }
    h1 { margin: 0; flex: 1; font: 600 1.1rem/1.3 system-ui, sans-serif; overflow-wrap: anywhere }
    output { font-size: .85rem; overflow-wrap: anywhere }
    button { font: inherit; padding: .35rem .7rem; white-space: nowrap }
    canvas { display: block; width: 100%; height: 100%; min-height: 0 }
  </style>
</head>
<body>
  <header><h1>${title}</h1><output role="status">Loading graph…</output><button disabled>Fit view</button></header>
  <canvas aria-label="Interactive graph"></canvas>
  <script type="module">
    import { mountGraph } from './graph.${language}'
    import workerURL from 'loom-core/layout-worker.js?url'

    const status = document.querySelector('output')
    const fit = document.querySelector('button')
    mountGraph(document.querySelector('canvas'), workerURL).then(graph => {
      status.textContent = ''
      fit.disabled = false
      fit.onclick = () => graph.fit()
      graph.on('select', id => { status.textContent = id ?? '' })
      window.addEventListener('pagehide', event => { if (!event.persisted) graph.destroy() })
    }).catch(error => { status.textContent = error.message })
  </script>
</body>
</html>
`
}

export function starterManifest(name, dependency, typescript) {
  return {
    name, private: true, type: 'module',
    scripts: { dev: 'vite', build: (typescript ? 'tsc --noEmit && ' : '') + 'vite build --base=./', preview: 'vite preview' },
    dependencies: { 'loom-core': dependency }, devDependencies: { vite: '7.3.8', ...(typescript && { typescript: '5.9.3' }) },
  }
}

/** Build the archive only on download. The preview and ZIP share the same mount code and SDK release. */
export async function projectZip({ name, scene, language, dependency }) {
  const { strToU8, zip } = await import('fflate')
  const typescript = language === 'ts'
  const manifest = starterManifest('loom-graph-export', dependency, typescript)
  const readme = `# Your Loom graph

Use Node.js 22.12 or newer. From this folder, install the dependencies and start the development server.

\`\`\`sh
${projectCommands}
\`\`\`

Open the local URL printed by Vite. To deploy the graph, run \`npm run build\` and serve the generated \`dist/\` directory.

To use the graph in an existing app, copy \`scene.json\` and \`graph.${language}\` together, install the loom-core dependency from package.json, and call \`await mountGraph(canvas)\` after your canvas has a width and height. Keep the returned graph and call \`graph.destroy()\` when the canvas unmounts.

The starter passes Vite's bundled layout worker URL for large graphs. With another bundler, you can serve the package's layout-worker.js and pass its URL as the second argument. Artwork URLs in the scene are fetched from their original hosts.
`
  const files = {
    'package.json': strToU8(JSON.stringify(manifest, null, 2) + '\n'),
    ...(typescript && { 'tsconfig.json': strToU8(JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true },
      include: ['graph.ts'],
    }, null, 2) + '\n') }),
    'index.html': strToU8(projectHTML(name, language)),
    ['graph.' + language]: strToU8(mountCode(language) + '\n'),
    'scene.json': strToU8(JSON.stringify(scene, null, 2) + '\n'),
    'README.md': strToU8(readme),
  }
  return new Promise((resolve, reject) => zip(files, { level: 1 }, (error, bytes) => {
    if (error) reject(error)
    else resolve(bytes)
  }))
}
