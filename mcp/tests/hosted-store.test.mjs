import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openStore } from '../hosted/store.mjs'

test('guest identity, grants and single-use codes survive a service restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'loom-oidc-'))
  const file = join(dir, 'state.sqlite')
  let store = openStore(file)
  try {
    const key = store.jwk.kid, cookie = store.cookieKey
    new store.Adapter('Session').upsert('session', { uid: 'visitor' }, 60)
    new store.Adapter('AuthorizationCode').upsert('code', { grantId: 'grant' }, 60)
    store.close()
    store = openStore(file)
    assert.equal(store.jwk.kid, key)
    assert.equal(store.cookieKey, cookie)
    assert.equal(new store.Adapter('Session').findByUid('visitor').uid, 'visitor')
    const codes = new store.Adapter('AuthorizationCode')
    codes.consume('code')
    assert.ok(codes.find('code').consumed > 0)
    assert.throws(() => codes.consume('code'))
    codes.revokeByGrantId('grant')
    assert.equal(codes.find('code'), undefined)
    codes.upsert('expired', { grantId: 'old' }, -10)
    assert.equal(codes.find('expired'), undefined)
  } finally { store.close(); await rm(dir, { recursive: true, force: true }) }
})
