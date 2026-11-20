import { fileURLToPath } from 'node:url'
import { defineConfig } from 'playwright/test'

const port = process.env.LOOM_DEV_TEST_PORT || '4289'
const baseURL = 'http://localhost:' + port + (process.env.PAGES_BASE_PATH ?? '/loom') + '/'

export default defineConfig({
  testMatch: 'studio-dev.spec.mjs',
  outputDir: '../artifacts/dev-tests',
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    channel: process.env.LOOM_BROWSER_CHANNEL,
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run site:dev',
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { PORT: port, NEXT_TELEMETRY_DISABLED: '1' },
    url: baseURL,
    timeout: 120_000,
  },
})
