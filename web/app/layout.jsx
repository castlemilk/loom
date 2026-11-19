import './globals.css'

export const metadata = {
  title: 'Loom · Graph studio',
  description: 'Explore a knowledge graph and shape its layout, springs, artwork and connections.',
}

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>
}
