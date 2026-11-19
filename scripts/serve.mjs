import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
export function serve(port = 0, isolated = true) {
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (pathname === '/') {
      res.writeHead(302, { location: '/demo/' })
      res.end()
      return
    }
    const filename = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''))
    if (!filename.startsWith(root) || !/^\/(demo|dist|tests)\//.test(pathname)) {
      res.writeHead(404)
      res.end()
      return
    }
    try {
      const bytes = await readFile(filename)
      res.setHeader(
        'Content-Type',
        {
          '.js': 'text/javascript',
          '.mjs': 'text/javascript',
          '.html': 'text/html',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
        }[path.extname(filename)] ?? 'application/octet-stream',
      )
      if (isolated) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      }
      res.end(bytes)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () =>
      resolve({ server, url: 'http://127.0.0.1:' + server.address().port }),
    )
  })
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await import('./build.mjs')
  const { url } = await serve(Number(process.env.PORT ?? 4173))
  console.log('Loom studio ' + url + '/demo/')
}
