import assert from 'node:assert/strict'
import { test } from 'node:test'
import sdk from '../package.json' with { type: 'json' }
import { publishedIntegrity, registrySpec, studioDependency } from '../scripts/npm-registry.mjs'

const archiveURL = 'https://castlemilk.github.io/loom/packages/preview/loom-core.tgz'
const digest = 'sha512-' + Buffer.alloc(64, 1).toString('base64')
const metadata = { name: sdk.name, version: sdk.version, dist: { integrity: digest } }

test('Studio pins an exact npm version only for the same release archive', async () => {
  const published = await publishedIntegrity(async url => {
    assert.equal(url.href, 'https://registry.npmjs.org/' + sdk.name + '/' + sdk.version)
    return Response.json(metadata)
  })
  assert.deepEqual(studioDependency(digest, published, archiveURL), { dependency: sdk.version, installSpec: registrySpec })
  const missing = await publishedIntegrity(async () => new Response(null, { status: 404 }))
  for (const other of [missing, undefined, 'sha512-another-release']) {
    assert.deepEqual(studioDependency(digest, other, archiveURL), { dependency: archiveURL, installSpec: archiveURL })
  }
})

test('A registry error or malformed release cannot be mistaken for an available package name', async () => {
  await assert.rejects(publishedIntegrity(async () => new Response(null, { status: 503 })), /503/)
  for (const record of [{}, { ...metadata, name: 'other' }, { ...metadata, version: 'other' }, { ...metadata, dist: {} }]) {
    await assert.rejects(publishedIntegrity(async () => Response.json(record)), /Unexpected npm metadata/)
  }
})
