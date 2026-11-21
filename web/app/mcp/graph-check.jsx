'use client'

import { useEffect, useRef, useState } from 'react'
import sample from '../../public/examples/team-graph.json'
import { homeURL } from '../../site'

export function GraphCheck({ onFile }) {
  const [state, setState] = useState({}), sequence = useRef(0), input = useRef(null)
  useEffect(() => () => { sequence.current++ }, [])

  async function open(file) {
    const current = ++sequence.current
    const name = file ? file.name : 'team-graph.json'
    if (!file && input.current) input.current.value = ''
    setState({ name, loading: true })
    onFile(name, false)
    try {
      const [{ previewGraph }, document] = await Promise.all([
        import('../../../mcp/demo/owner-preview.mjs'),
        file ? file.text().then(text => JSON.parse(text.replace(/^\uFEFF/, ''))) : sample,
      ])
      if (sequence.current !== current) return
      const receipt = await previewGraph(document, name)
      if (sequence.current !== current) return
      setState({ name, receipt })
      onFile(name, true)
    } catch (error) {
      if (sequence.current !== current) return
      setState({ name, error: error instanceof SyntaxError ? 'This file contains invalid JSON.' : error.message })
    }
  }
  function clear() {
    sequence.current++
    input.current.value = ''
    setState({})
    onFile('', true)
  }
  const r = state.receipt
  return <div className="owner-check">
    <label className="graph-file-label" htmlFor="owner-graph">Preview a graph file</label>
    <input id="owner-graph" ref={input} type="file" accept=".json,application/json" onChange={event => {
      const file = event.target.files[0]
      if (file) open(file)
    }} />
    <p>Choose a JSON file with nodes and links, or a Studio export. The file stays in this tab.</p>
    <div className="owner-sample"><button type="button" onClick={() => open(null)}>Try the sample graph</button>
      <a href={homeURL + 'examples/team-graph.json'} download="team-graph.json">Download sample JSON</a></div>
    {state.name && <div className="owner-receipt" aria-live="polite">
      {state.loading && <p role="status">Querying {state.name}…</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {r && <><p className="owner-count">{r.graph.name} · {r.graph.nodes} nodes · {r.graph.links} links</p>
        <code>{r.tool}</code><h4>{r.title}</h4>
        {r.tool === 'get_connection' && typeof r.result.items[0]?.kind === 'string' && <p>Relationship <code>{r.result.items[0].kind}</code></p>}
        <details><summary>MCP request and result</summary><pre tabIndex={0}>{JSON.stringify({ name: r.tool, arguments: r.args, result: r.result }, null, 2)}</pre></details>
        <p className="owner-question">Ask your assistant <em>“{r.question}”</em></p></>}
      <button className="owner-clear" type="button" onClick={clear}>Clear preview</button>
    </div>}
  </div>
}
