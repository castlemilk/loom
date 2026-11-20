import { artURL, homeURL, siteOrigin } from '../site'

export const metadata = {
  metadataBase: new URL(siteOrigin),
  title: 'Loom · TypeScript graph visualization library',
  icons: { icon: { url: artURL('loom-mark.svg'), type: 'image/svg+xml' } },
}

export default function RootLayout({ children }) {
  return <html lang="en"><head><link rel="sitemap" type="application/xml" href={homeURL + 'sitemap.xml'} /></head><body>{children}</body></html>
}
