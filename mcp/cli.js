#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createLoomMcpServerFactory, loadBuiltinGraphs, loadGraphFile } from './server.js'

try {
  const { values } = parseArgs({ options: { graph: { type: 'string' }, help: { type: 'boolean', short: 'h' } } })
  if (values.help) {
    console.log('loom-graph-mcp [--graph /path/to/scene.json]\nServe bundled knowledge graphs or a local Loom graph over MCP stdio.')
  } else {
    const sources = values.graph === undefined ? await loadBuiltinGraphs() : [await loadGraphFile(values.graph)]
    serveStdio(createLoomMcpServerFactory(sources), { onerror: error => console.error(error.message) })
  }
} catch (error) {
  console.error('Loom Graph MCP: ' + error.message)
  process.exitCode = 1
}
