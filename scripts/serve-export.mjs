import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'

const siteRoot = fileURLToPath(new URL('../web/out/', import.meta.url))
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.md': 'text/markdown; charset=utf-8',
}

// Serve the exported site with the same single-range GETs used by the SQLite worker on Pages.
export async function serveExport(base = '/loom/', port = 0, root = siteRoot) {
  const compressed = new Map()
  const encode = promisify(gzip)
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      if (!['GET', 'HEAD'].includes(req.method) || !pathname.startsWith(base)) {
        res.writeHead(404).end()
        return
      }
      const file = resolve(root, pathname.slice(base.length) + (pathname.endsWith('/') ? 'index.html' : ''))
      if (!file.startsWith(resolve(root) + sep)) {
        res.writeHead(404).end()
        return
      }
      const info = await stat(file)
      if (!info.isFile()) {
        res.writeHead(404).end()
        return
      }
      const size = info.size
      const headers = {
        'Accept-Ranges': 'bytes',
        'Content-Length': size,
        'Content-Type': types[extname(file)] || 'application/octet-stream',
      }
      // Pages negotiates a compressed representation on ordinary HEAD/GET, but
      // browsers request identity encoding for SQLite byte ranges.
      if (extname(file) === '.sqlite') {
        headers.Vary = 'Accept-Encoding'
        if (!req.headers.range && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
          if (!compressed.has(file))
            compressed.set(
              file,
              readFile(file).then((bytes) => encode(bytes)),
            )
          const encoded = await compressed.get(file)
          res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': encoded.length })
          res.end(req.method === 'HEAD' ? undefined : encoded)
          return
        }
      }
      let slice
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
        const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2]))
        const end = match?.[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
        if (!match || !(match[1] || match[2]) || !(start <= end && start < size)) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + size }).end()
          return
        }
        slice = { start, end }
        headers['Content-Length'] = end - start + 1
        headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size
      }
      res.writeHead(slice ? 206 : 200, headers)
      if (req.method === 'HEAD') res.end()
      else {
        const stream = createReadStream(file, slice)
        res.on('close', () => stream.destroy())
        stream.on('error', () => res.destroy()).pipe(res)
      }
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((done, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', done)
  })
  return { url: 'http://127.0.0.1:' + server.address().port + base, close: () => server.close() }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log((await serveExport((process.env.PAGES_BASE_PATH ?? '/loom') + '/', Number(process.env.PORT ?? 4188))).url)
}
