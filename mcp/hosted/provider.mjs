import { createHmac, randomUUID } from 'node:crypto'
import { Provider, errors } from 'oidc-provider'
import { pagesClient } from './config.mjs'

const scope = 'graph:read'
const styles = `*{box-sizing:border-box}body{margin:0;background:#f5f3ea;color:#1d3027;font:17px/1.55 system-ui,sans-serif}main{max-width:35rem;margin:clamp(3rem,13vh,9rem) auto;padding:1.5rem}header{font:14px ui-monospace,monospace;color:#48604f}h1{margin:1.5rem 0 .6rem;font:normal clamp(2.6rem,7vw,4rem)/1.05 Georgia,serif}p{margin:.8rem 0 1.5rem}form{border-top:1px solid #a7b4a6;padding-top:1.4rem;display:flex;gap:.7rem;flex-wrap:wrap}button{font:inherit;padding:.6rem 1rem;border:1px solid #233e30;background:#233e30;color:white;border-radius:.25rem;cursor:pointer}button[value=deny]{color:#233e30;background:transparent}button:focus-visible{outline:3px solid #a95322;outline-offset:3px}code{font-size:.9em}`

export function guestProvider({ issuer, callback, store }) {
  const resource = issuer + '/mcp'
  const origin = new URL(callback).origin
  const secure = new URL(issuer).protocol === 'https:'
  const oidc = new Provider(issuer, {
    adapter: store.Adapter,
    jwks: { keys: [store.jwk] },
    clients: [{ client_id: pagesClient, client_name: 'Loom on GitHub Pages', redirect_uris: [callback],
      token_endpoint_auth_method: 'none', response_types: ['code'], grant_types: ['authorization_code'] }],
    cookies: { keys: [store.cookieKey], short: { secure, sameSite: 'lax' }, long: { secure, sameSite: 'lax' } },
    pkce: { required: () => true },
    ttl: { AccessToken: 300, AuthorizationCode: 120, Interaction: 600, Session: 3600, Grant: 3600 },
    findAccount: async (_ctx, id) => ({ accountId: id, claims: async () => ({ sub: id }) }),
    clientBasedCORS: (_ctx, requestOrigin, client) => client.clientId === pagesClient && requestOrigin === origin,
    interactions: { url: (_ctx, interaction) => '/interaction/' + interaction.uid },
    features: {
      devInteractions: { enabled: false },
      resourceIndicators: { enabled: true, getResourceServerInfo(_ctx, requested) {
        if (requested !== resource) throw new errors.InvalidTarget()
        return { scope, audience: resource, accessTokenFormat: 'jwt', accessTokenTTL: 300,
          jwt: { sign: { alg: 'RS256', kid: store.jwk.kid } } }
      } },
    },
  })
  oidc.proxy = secure
  const dispatch = oidc.callback()
  const csrf = (uid, prompt) => createHmac('sha256', store.cookieKey).update(uid + ':' + prompt).digest('base64url')
  async function interaction(req, res, uid) {
    let details
    try { details = await oidc.interactionDetails(req, res) }
    catch { res.writeHead(400).end('This request has expired. Return to Loom and connect again.'); return }
    const { prompt, params, session } = details
    if (details.uid !== uid || params.client_id !== pagesClient || !['login', 'consent'].includes(prompt.name)) {
      res.writeHead(400).end('Unknown authorization request.'); return
    }
    const login = prompt.name === 'login'
    if (req.method === 'GET') {
      const title = login ? 'Try Loom as a guest' : 'Allow read access?'
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' " + origin + "; frame-ancestors 'none'; base-uri 'none'" })
      res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Loom</title><style>${styles}</style><main><header>Loom / Guest authorization</header><h1>${title}</h1><p>${login ? 'Start a guest session to explore the public knowledge graphs. No account or password is required.' : 'Loom on GitHub Pages is requesting permission to read public graph nodes, connections and their cited sources for five minutes (<code>graph:read</code>).'}</p><form method="post"><input type="hidden" name="csrf" value="${csrf(uid, prompt.name)}"><button name="decision" value="allow">${login ? 'Continue as guest' : 'Allow graph access'}</button><button name="decision" value="deny">Cancel</button></form></main></html>`)
      return
    }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'GET, POST' }).end(); return }
    if (req.headers.origin !== issuer || req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
      res.writeHead(403).end('Use the authorization form.'); return
    }
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 2048) { res.writeHead(413).end(); return }
    }
    const form = new URLSearchParams(body), decision = form.get('decision')
    if (form.get('csrf') !== csrf(uid, prompt.name) || !['allow', 'deny'].includes(decision)) {
      res.writeHead(403).end('Invalid authorization form.'); return
    }
    if (decision === 'deny') {
      return oidc.interactionFinished(req, res, { error: 'access_denied', error_description: 'The visitor declined graph access.' }, { mergeWithLastSubmission: false })
    }
    if (login) return oidc.interactionFinished(req, res, { login: { accountId: randomUUID() } }, { mergeWithLastSubmission: false })
    const grant = details.grantId ? await oidc.Grant.find(details.grantId) : new oidc.Grant({ accountId: session.accountId, clientId: pagesClient })
    if (!grant) { res.writeHead(400).end('This grant has expired. Connect again.'); return }
    if (prompt.details.missingOIDCScope) grant.addOIDCScope(prompt.details.missingOIDCScope.join(' '))
    if (prompt.details.missingResourceScopes?.[resource]) grant.addResourceScope(resource, scope)
    return oidc.interactionFinished(req, res, { consent: { grantId: await grant.save() } }, { mergeWithLastSubmission: true })
  }
  return (req, res, path) => {
    const match = /^\/interaction\/([A-Za-z0-9_-]+)$/.exec(path)
    if (match) return interaction(req, res, match[1])
    if (path === '/.well-known/oauth-authorization-server') req.url = '/.well-known/openid-configuration'
    return dispatch(req, res)
  }
}
