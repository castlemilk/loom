import { artURL, homeURL, siteOrigin } from '../site'

export const metadata = {
  metadataBase: new URL(siteOrigin),
  title: 'Loom · TypeScript graph visualization library',
  icons: { icon: { url: artURL('loom-icon.png'), sizes: '48x48', type: 'image/png' },
    apple: { url: artURL('loom-touch.png'), sizes: '180x180', type: 'image/png' } },
}

export default function RootLayout({ children }) {
  return <html lang="en"><head><link rel="sitemap" type="application/xml" href={homeURL + 'sitemap.xml'} /><link rel="describedby" href={homeURL + 'llms.txt'} /></head><body>{children}</body></html>
}
