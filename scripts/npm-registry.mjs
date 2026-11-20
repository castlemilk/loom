import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import sdk from '../package.json' with { type: 'json' }

export const archiveName = sdk.name + '-' + sdk.version + '.tgz'
export const registrySpec = sdk.name + '@' + sdk.version

export async function publishedIntegrity(request = fetch) {
  const url = new URL(encodeURIComponent(sdk.name) + '/' + encodeURIComponent(sdk.version), sdk.publishConfig.registry)
  const response = await request(url, { signal: AbortSignal.timeout(10000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('npm registry returned HTTP ' + response.status)
  const pkg = await response.json()
  if (pkg.name !== sdk.name || pkg.version !== sdk.version || !pkg.dist?.integrity?.startsWith('sha512-')) {
    throw new Error('Unexpected npm metadata for ' + registrySpec)
  }
  return pkg.dist.integrity
}

export function studioDependency(archiveIntegrity, registryIntegrity, archiveURL) {
  return archiveIntegrity === registryIntegrity
    ? { dependency: sdk.version, installSpec: registrySpec }
    : { dependency: archiveURL, installSpec: archiveURL }
}

export async function fileIntegrity(path) {
  return 'sha512-' + createHash('sha512').update(await readFile(path)).digest('base64')
}

// The release workflow may retry a completed publish, but a version with other bytes belongs to a different release.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, mode] = process.argv.slice(2)
  const integrity = await fileIntegrity(file)
  for (let attempt = 1; ; attempt++) {
    const published = await publishedIntegrity()
    if (published && published !== integrity) throw new Error(registrySpec + ' already exists with a different SHA-512 digest')
    if (published || mode !== '--wait' || attempt === 12) {
      if (!published && mode === '--wait') throw new Error('Timed out waiting for ' + registrySpec)
      console.log(published ? 'published' : 'unpublished')
      break
    }
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}
