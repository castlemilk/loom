import { fileURLToPath } from 'node:url'
import createMDX from '@next/mdx'
import rehypeSlug from 'rehype-slug'
import { docsOutline } from './docs/outline.mjs'

const basePath = process.env.PAGES_BASE_PATH ?? '/loom'

const withMDX = createMDX({ options: { rehypePlugins: [rehypeSlug, docsOutline] } })
export default withMDX({
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'mdx'],
  output: 'export',
  outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)),
  basePath,
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
  devIndicators: false,
})
