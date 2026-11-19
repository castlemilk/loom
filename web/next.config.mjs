import { fileURLToPath } from 'node:url'

const basePath = process.env.PAGES_BASE_PATH ?? '/loom'

export default {
  output: 'export',
  outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)),
  basePath,
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
  devIndicators: false,
}
