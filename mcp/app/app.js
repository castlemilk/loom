import { App } from '@modelcontextprotocol/ext-apps'

const app = new App({ name: 'Loom graph browser', version: '1.0.0' })
const element = id => document.getElementById(id)
const graph = element('graphs'), query = element('query'), status = element('status')
const choices = element('choices'), search = element('search'), source = element('source')
let revision = 0

function screen(title, message) {
  revision++
  element('heading').textContent = title
  choices.replaceChildren()
  status.textContent = message
  search.hidden = true
  element('connection').hidden = true
  element('browse').hidden = false
}

async function call(name, args, render) {
  const current = ++revision
  choices.replaceChildren()
  status.textContent = 'Reading graph…'
  try {
    const result = await app.callServerTool({ name, arguments: args })
    if (current !== revision) return
    if (result.isError || !result.structuredContent) throw new Error(result.content?.[0]?.text || 'The server could not read this graph.')
    render(result.structuredContent)
  } catch (error) {
    if (current === revision) status.textContent = error.message
  }
}

function row(label, activate) {
  const item = document.createElement('li'), button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.onclick = activate
  item.append(button)
  choices.append(item)
}

function connection(result) {
  const { from, to, total, evidence } = result
  const message = total ? total + (total === 1 ? ' directed link.' : ' directed links.') : 'No directed link between these nodes.'
  screen(from.label + ' → ' + to.label, message + (total && !evidence?.excerpt ? ' No archived passage is available.' : ''))
  element('connection').hidden = !total
  const excerpt = element('excerpt')
  excerpt.textContent = typeof evidence?.excerpt === 'string' ? evidence.excerpt : ''
  excerpt.hidden = !excerpt.textContent
  const url = URL.canParse(evidence?.sourceUrl) ? new URL(evidence.sourceUrl) : null
  source.removeAttribute('href')
  source.hidden = !url || !['https:', 'http:'].includes(url.protocol)
  if (!source.hidden) source.href = url.href
}

function neighbors(graphId, from) {
  screen(from.label, '')
  call('get_neighbors', { graph: graphId, id: from.id, direction: 'outgoing', limit: 12 }, result => {
    status.textContent = result.total ? 'Outgoing neighbors · showing ' + result.items.length + ' of ' + result.total : 'This node has no outgoing neighbors.'
    for (const { node } of result.items) {
      row(node.label, () => call('get_connection', { graph: graphId, from: from.id, to: node.id }, connection))
    }
  })
}

function catalog({ graphs }) {
  screen('Graph browser', graphs.length ? 'Search a graph to follow its outgoing links.' : 'This server has no graphs.')
  element('browse').hidden = true
  const selected = graph.value
  graph.replaceChildren(...graphs.map(g => new Option(g.name + ' · ' + g.nodes + ' nodes', g.id)))
  if (graphs.some(g => g.id === selected)) graph.value = selected
  search.hidden = !graphs.length
}
element('browse').onclick = () => call('list_graphs', {}, catalog)
function findNodes() {
  const graphId = graph.value, text = query.value.trim()
  if (!text) return
  call('search_nodes', { graph: graphId, query: text, limit: 12 }, result => {
    status.textContent = result.total ? 'Matching nodes · showing ' + result.items.length + ' of ' + result.total : 'No matching nodes.'
    for (const node of result.items) row(node.label, () => neighbors(graphId, node))
  })
}
element('find').onclick = findNodes
query.oninput = () => { element('find').disabled = !query.value.trim() }
query.onkeydown = event => { if (event.key === 'Enter' && !event.isComposing) findNodes() }
graph.onchange = () => { revision++; choices.replaceChildren(); status.textContent = 'Search this graph to find a node.' }
source.onclick = async event => {
  if (!app.getHostCapabilities()?.openLinks) return
  event.preventDefault()
  try {
    if ((await app.openLink({ url: source.href })).isError) throw new Error('The host could not open this source.')
  } catch (error) { status.textContent = error.message }
}
app.ontoolresult = result => {
  if (result.isError) screen('Graph browser', result.content?.[0]?.text || 'The server could not read this graph.')
  else if (result.structuredContent?.graphs) catalog(result.structuredContent)
  else if (result.structuredContent?.from && result.structuredContent?.to) connection(result.structuredContent)
}
app.connect().catch(error => { status.textContent = error.message })
