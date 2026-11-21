import { toNodeHandler } from '@modelcontextprotocol/node'
import {
  createMcpHandler, getOAuthProtectedResourceMetadataUrl, OAuthError, OAuthErrorCode, oauthMetadataResponse, requireBearerAuth,
} from '@modelcontextprotocol/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const readScope = 'graph:read'
const loopback = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname)

function endpoint(value, name) {
  const url = new URL(value)
  if (url.username || url.password || url.hash || url.search ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback(url.hostname)))) {
    throw new Error(name + ' requires HTTPS, or HTTP on loopback, without credentials, query or fragment.')
  }
  return url
}

async function discoverIssuer(issuer) {
  const url = endpoint(issuer, 'Issuer')
  const discovery = new URL(url.href.replace(/\/$/, '') + '/.well-known/openid-configuration')
  const response = await fetch(discovery, { redirect: 'error', signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('Issuer discovery returned HTTP ' + response.status)
  const metadata = await response.json()
  if (metadata.issuer !== issuer) throw new Error('Discovery issuer differs from the configured issuer.')
  const keys = endpoint(metadata.jwks_uri, 'Signing key URL')
  if (keys.protocol === 'http:' && keys.origin !== url.origin) throw new Error('HTTP signing keys must share the local issuer origin.')
  return { metadata, keys: createRemoteJWKSet(keys) }
}

// One read-only index serves both current and legacy Streamable HTTP clients.
export async function graphHttpHandler(factory, { resourceUrl, issuer }) {
  const resource = endpoint(resourceUrl, 'Resource URL')
  if (!issuer && !loopback(resource.hostname)) throw new Error('A public resource URL requires an OAuth issuer.')
  const mcp = createMcpHandler(factory)
  let gate, metadataOptions
  if (issuer !== undefined) {
    const { metadata, keys } = await discoverIssuer(issuer)
    metadataOptions = { resourceServerUrl: resource, oauthMetadata: metadata, resourceName: 'Loom Graph MCP', scopesSupported: [readScope],
      dangerouslyAllowInsecureIssuerUrl: new URL(issuer).hostname === '[::1]' }
    gate = requireBearerAuth({
      expectedResource: resource, requiredScopes: [readScope], resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource),
      verifier: { async verifyAccessToken(token) {
        try {
          const { payload } = await jwtVerify(token, keys, {
            issuer, audience: resource.href, algorithms: ['RS256'], requiredClaims: ['exp'],
          })
          const clientId = payload.client_id ?? payload.azp
          if (typeof clientId !== 'string' || payload.cnf) throw new Error('Expected a bearer access token.')
          return { token, clientId, scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : [],
            expiresAt: payload.exp, resource }
        } catch (error) {
          if (error instanceof TypeError || error.code === 'ERR_JWKS_TIMEOUT') {
            throw new OAuthError(OAuthErrorCode.ServerError, 'Signing keys unavailable')
          }
          throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token')
        }
      } },
    })
  }
  return toNodeHandler({ async fetch(request) {
    const origin = request.headers.get('origin')
    if (request.headers.get('host') !== resource.host || (origin !== null && origin !== resource.origin)) {
      return new Response('Unrecognized host or origin', { status: 403 })
    }
    if (metadataOptions) {
      const document = oauthMetadataResponse(request, metadataOptions)
      if (document) return document
    }
    if (new URL(request.url).pathname !== resource.pathname) return new Response('Not found', { status: 404 })
    const authInfo = await gate?.(request)
    return authInfo instanceof Response ? authInfo : mcp.fetch(request, { authInfo })
  } })
}
