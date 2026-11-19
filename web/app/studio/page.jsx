import sample from '../../.generated/sample.json'
import Studio from '../studio.jsx'
import '../globals.css'

export const metadata = {
  title: 'Graph studio',
  description: 'Move nodes, open groups and configure a live WebGL2 graph.',
}

export default function StudioPage() {
  return <Studio sample={sample} />
}
