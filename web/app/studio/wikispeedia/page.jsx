import Wikispeedia from './view'
export const metadata = {
  title: 'Wikispeedia · Wikipedia atlas',
  description: 'Explore 4,604 Wikipedia articles by loading topics from SQLite as you open them.',
}
export default function Page() {
  return <Wikispeedia />
}
