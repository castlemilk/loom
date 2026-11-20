import AroundCanva from './view'
import { cardsImage, pageMetadata } from '../../../metadata'
import { studioURL } from '../../../site'

export const metadata = pageMetadata({
  path: studioURL + 'cards/', title: 'Canva founders and investors in a relationship graph · Loom Studio',
  description: 'Explore Canva, its founders and investors in an interactive card graph. Select a relationship to inspect its label and follow its evidence.',
  image: cardsImage,
})
export default function Page() {
  return <AroundCanva />
}
