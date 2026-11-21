import { pagesCallback, publicIssuer } from './config.mjs'
import { hostedService } from './service.mjs'
import { readFileSync } from 'node:fs'

process.umask(0o077)
const server = await hostedService({
  issuer: process.env.LOOM_PUBLIC_ORIGIN || publicIssuer, callback: process.env.LOOM_PAGES_CALLBACK || pagesCallback,
  database: process.env.LOOM_AUTH_DB || '/var/lib/loom/oauth.sqlite',
  revision: JSON.parse(readFileSync(new URL('../release.json', import.meta.url), 'utf8')).revision,
})
server.listen(Number(process.env.PORT || 8080), '0.0.0.0')
process.on('SIGTERM', () => server.close())
