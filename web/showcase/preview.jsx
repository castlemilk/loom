import { createRoot } from 'react-dom/client'
import { installVirtualClock } from 'stageshow-clock'
import { StudioScene, SdkScene, McpScene } from './scenes'

const params = new URLSearchParams(location.search)
const Scene = { studio: StudioScene, sdk: SdkScene, mcp: McpScene }[params.get('scene') ?? 'studio']
const data = await (await fetch('/data.json')).json()
if (params.has('record')) installVirtualClock({ fps: 24 })
createRoot(document.getElementById('scene')).render(<Scene data={data} />)
