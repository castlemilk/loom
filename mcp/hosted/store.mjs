import { DatabaseSync } from 'node:sqlite'
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto'
import { errors } from 'oidc-provider'

// The provider owns the protocol. SQLite keeps its opaque records and signing
// identity across process restarts on the service's single-writer volume.
export function openStore(filename) {
  const db = new DatabaseSync(filename)
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS identity (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS records (model TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
      expires INTEGER, grant_id TEXT, uid TEXT, user_code TEXT, PRIMARY KEY(model, id));
    CREATE INDEX IF NOT EXISTS records_grant ON records(grant_id);
    CREATE INDEX IF NOT EXISTS records_uid ON records(model, uid);
    CREATE INDEX IF NOT EXISTS records_user_code ON records(model, user_code);
    CREATE INDEX IF NOT EXISTS records_expiry ON records(expires);`)
  let row = db.prepare('SELECT value FROM identity WHERE id=1').get()
  if (!row) {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const jwk = { ...privateKey.export({ format: 'jwk' }), alg: 'RS256', use: 'sig', kid: randomUUID() }
    const value = JSON.stringify({ jwk, cookieKey: randomBytes(32).toString('hex') })
    db.prepare('INSERT OR IGNORE INTO identity VALUES(1, ?)').run(value)
    row = db.prepare('SELECT value FROM identity WHERE id=1').get()
  }
  const upsert = db.prepare('INSERT OR REPLACE INTO records VALUES(?, ?, ?, ?, ?, ?, ?)')
  const select = column => db.prepare('SELECT data FROM records WHERE model=? AND ' + column + '=? AND (expires IS NULL OR expires > unixepoch())')
  const byId = select('id'), byUid = select('uid'), byCode = select('user_code')
  const remove = db.prepare('DELETE FROM records WHERE model=? AND id=?')
  const revoke = db.prepare('DELETE FROM records WHERE grant_id=?')
  const consume = db.prepare("UPDATE records SET data=json_set(data, '$.consumed', unixepoch()) WHERE model=? AND id=? AND json_extract(data, '$.consumed') IS NULL AND (expires IS NULL OR expires > unixepoch())")
  const prune = db.prepare('DELETE FROM records WHERE expires <= unixepoch()')
  prune.run()
  const cleanup = setInterval(() => prune.run(), 60_000).unref()
  const lookup = (statement, model, key) => {
    const found = statement.get(model, key)
    return found && JSON.parse(found.data)
  }
  class Adapter {
    constructor(model) { this.model = model }
    upsert(id, payload, ttl) {
      upsert.run(this.model, id, JSON.stringify(payload), Number.isFinite(ttl) ? Math.floor(Date.now() / 1000) + ttl : null,
        payload.grantId ?? null, payload.uid ?? null, payload.userCode ?? null)
    }
    find(id) { return lookup(byId, this.model, id) }
    findByUid(uid) { return lookup(byUid, this.model, uid) }
    findByUserCode(code) { return lookup(byCode, this.model, code) }
    destroy(id) { remove.run(this.model, id) }
    consume(id) {
      if (!consume.run(this.model, id).changes) throw new errors.InvalidGrant('Code already used or expired')
    }
    revokeByGrantId(grantId) { revoke.run(grantId) }
  }
  return { ...JSON.parse(row.value), Adapter, close() { clearInterval(cleanup); db.close() } }
}
