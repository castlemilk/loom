export const publicIssuer = 'https://loom-graph.apps.deephost.benebsworth.com'
export const pagesCallback = 'https://castlemilk.github.io/loom/mcp/live/'
export const pagesClient = 'loom-pages'

export function guestConfig(issuer = publicIssuer) {
  return { issuer, resource: issuer + '/mcp', clientId: pagesClient, provider: 'Loom Guest', hosted: true }
}
