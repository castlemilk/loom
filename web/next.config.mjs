import { fileURLToPath } from 'node:url'
import createMDX from '@next/mdx'
import sdk from '../package.json' with { type: 'json' }
import rehypeSlug from 'rehype-slug'
import { docsOutline } from './docs/outline.mjs'

const basePath = process.env.PAGES_BASE_PATH ?? '/loom'

const withMDX = createMDX({ options: { rehypePlugins: [rehypeSlug, docsOutline] } })
export default withMDX({
  output: 'export',
  outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)),
  basePath,
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_LOOM_REVISION: process.env.GITHUB_SHA ?? '', NEXT_PUBLIC_LOOM_VERSION: sdk.version },
  images: { unoptimized: true },
  devIndicators: false,
})
