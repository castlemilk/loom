import { artURL } from '../site'

export const metadata = {
  metadataBase: new URL('https://castlemilk.github.io'),
  title: { default: 'Loom · A field guide to graphs', template: '%s · Loom' },
  description: 'Explore graph layout, grouping and relationships with Loom, a WebGL2 graph studio and TypeScript library.',
  icons: { icon: { url: artURL('loom-mark.svg'), type: 'image/svg+xml' } },
}

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>
}
