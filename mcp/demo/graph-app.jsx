import { useEffect, useRef, useState } from 'react'
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge'

export function GraphApp({ session, onClose }) {
  const dialog = useRef(null)
  const iframe = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let closed = false
    const frame = iframe.current
    dialog.current.showModal()
    const bridge = new AppBridge(null, { name: 'Loom HTTP walkthrough', version: '1' }, { serverTools: {} })
    const report = err => { if (!closed) setError(err.message) }
    async function open() {
      const { html, result, args } = await session.openApp()
      if (closed) return
      bridge.oncalltool = params => session.callAppTool(params)
      bridge.oninitialized = async () => {
        try {
          await bridge.sendToolInput({ arguments: args })
          await bridge.sendToolResult(result)
        } catch (error) { report(error) }
      }
      await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow))
      if (!closed) frame.srcdoc = html
    }
    open().catch(report)
    return () => { closed = true; bridge.close().catch(() => {}) }
  }, [session])
  return <dialog ref={dialog} className="demo-graph-app" aria-label="Graph browser" onClose={onClose}>
    <div className="graph-app-toolbar"><span>MCP App</span><button type="button" autoFocus onClick={() => dialog.current.close()}>Close graph browser</button></div>
    {error ? <p role="alert">{error}</p> :
      <iframe title="Loom graph browser" ref={iframe} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />}
  </dialog>
}
