import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { graphServerFactory } from './graph-server.js'

export { loadBuiltinGraphs, loadGraphFile } from './catalog.js'

const icons = [{ src: 'data:image/png;base64,' + readFileSync(new URL('./data/icon.png', import.meta.url)).toString('base64'), mimeType: 'image/png', sizes: ['256x256'] }]
const readBrowser = () => readFile(new URL('./data/graph-browser.html', import.meta.url), 'utf8')

export function createLoomMcpServerFactory(sources) {
  return graphServerFactory(sources, { icons, readBrowser })
}

export function createLoomMcpServer(sources) {
  return createLoomMcpServerFactory(sources)()
}
