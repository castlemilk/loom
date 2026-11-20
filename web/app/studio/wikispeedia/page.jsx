import Wikispeedia from './view'
import { atlasImage, pageMetadata } from '../../../metadata'
import { studioURL } from '../../../site'

export const metadata = pageMetadata({
  path: studioURL + 'wikispeedia/', title: 'Wikipedia topic map and article connections · Loom Studio',
  description: 'Explore 4,604 Wikipedia articles in the Wikispeedia graph. Open a topic, follow a hyperlink across subjects, and read the archived passage that connects two articles.',
  image: atlasImage,
})
export default function Page() {
  return <Wikispeedia />
}
