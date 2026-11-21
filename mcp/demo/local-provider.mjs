import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { exportJWK, generateKeyPair } from 'jose'
import { Provider, errors } from 'oidc-provider'

// Development interactions and ephemeral keys are confined to this loopback demo.
export async function startLocalProvider(config) {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  const key = { ...await exportJWK(privateKey), kid: 'demo', use: 'sig', alg: 'RS256' }
  const issuer = new URL(config.issuer)
  const oidc = new Provider(config.issuer, {
    clients: [{ client_id: config.clientId, client_name: 'Loom walkthrough', token_endpoint_auth_method: 'none',
      redirect_uris: [new URL('/demo/', config.resource).href], response_types: ['code'], grant_types: ['authorization_code'] }],
    jwks: { keys: [key] }, cookies: { keys: [randomBytes(32).toString('hex')] },
    features: { resourceIndicators: { enabled: true,
      getResourceServerInfo(_ctx, resource) {
        if (resource !== config.resource) throw new errors.InvalidTarget()
        return { scope: 'graph:read', audience: resource, accessTokenFormat: 'jwt', accessTokenTTL: 300,
          jwt: { sign: { alg: 'RS256', kid: key.kid } } }
      },
    } },
  })
  const dispatch = oidc.callback()
  const server = createServer((req, res) => {
    if (req.headers.host !== issuer.host) return res.writeHead(403).end()
    return dispatch(req, res)
  })
  server.listen(Number(issuer.port), '127.0.0.1')
  await once(server, 'listening')
  return server
}
