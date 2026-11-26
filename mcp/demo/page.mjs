import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

export async function demoAssets(site) {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('./client.jsx', import.meta.url))], outfile: 'client.js',
    nodePaths: [fileURLToPath(new URL('../../web/node_modules', import.meta.url))],
    bundle: true, write: false, jsx: 'automatic', format: 'esm', minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const assets = new Map(bundle.outputFiles.map(file => [file.path.endsWith('.css') ? 'client.css' : 'client.js', file.contents]))
  const title = 'Live OAuth graph query · Loom'
  const description = 'Authorize a five-minute guest session, query the hosted Loom knowledge graph and read the passage connecting Music to Sound.'
  const url = site && new URL('mcp/live/', site)
  const metadata = site ? `<link rel="canonical" href="${url}"><link rel="alternate" type="text/markdown" href="${new URL('index.md', url)}">
    <link rel="describedby" href="${new URL('llms.txt', site)}"><meta property="og:url" content="${url}"><meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}"><meta property="og:image" content="${new URL('illustrations/graph-mcp-social.jpg', site)}">
    <meta name="twitter:card" content="summary_large_image">` : ''
  assets.set('index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="referrer" content="no-referrer"><title>${title}</title><meta name="description" content="${description}">${metadata}
    <link rel="stylesheet" href="./client.css"></head><body><main id="demo"><header><h1>Connect over HTTP</h1></header>
    <noscript>Enable JavaScript to connect to the graph.${site ? ' <a href="./index.md">Read the walkthrough</a>.' : ''}</noscript></main>
    ${site ? `<section class="readable-walkthrough" aria-labelledby="readable-walkthrough">
      <h2 id="readable-walkthrough">Read the example without signing in</h2>
      <p>The historical Wikispeedia article on Music links to Sound in its opening definition.
        <a href="https://dlab.epfl.ch/wikispeedia/wpcd/wp/m/Music.htm">Read the archived Music article</a> or
        <a href="${new URL('node-graph/#wikispeedia', site)}">get the example data and permalink</a>.</p>
      <p>To run the live query, connect over HTTP and review the <code>graph:read</code> permission.
        The optional guest session lasts five minutes and cannot edit the graph.</p>
      <p><a href="./index.md">Read the complete walkthrough as Markdown</a></p>
    </section>` : ''}
    <script type="module" src="./client.js"></script></body></html>`)
  return assets
}
