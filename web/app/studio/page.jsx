import sample from '../../.generated/sample.json'
import Studio from '../studio.jsx'
import '../globals.css'
import { pageMetadata } from '../../metadata'
import { studioURL } from '../../site'

export const metadata = pageMetadata({
  path: studioURL, title: 'Loom Graph Studio · Interactive graph editor and layout demos',
  description: 'Open a graph, add nodes, draw connections, and switch between force layouts, lanes and orbits. Try each setting on a live WebGL2 canvas.',
})

export default function StudioPage() {
  return <Studio sample={sample} />
}
