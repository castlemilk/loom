import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { studio } from '../tests/studio.mjs'

const liveURL = process.argv[2]
const base = (process.env.PAGES_BASE_PATH ?? '/loom') + '/'
const url = liveURL || 'https://loom.test' + base
const root = fileURLToPath(new URL('../web/out/', import.meta.url))
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
try {
  const context = await browser.newContext({ viewport: { width: 1160, height: 760 }, reducedMotion: 'reduce' })
  if (!liveURL) {
    await context.route('**/*', async (route) => {
      const request = new URL(route.request().url())
      if (request.host !== 'loom.test' || !request.pathname.startsWith(base)) return route.abort()
      const file = path.resolve(root, request.pathname.slice(base.length) || 'index.html')
      if (!file.startsWith(root)) return route.abort()
      try {
        await route.fulfill({ path: file })
      } catch {
        await route.fulfill({ status: 404, body: 'Missing export asset' })
      }
    })
  }
  const page = await context.newPage()
  const failures = []
  let snapshots = 0
  page.on('response', (res) => {
    const resource = new URL(res.url()).pathname
    if (resource.endsWith('/graphs/knowledge.json')) snapshots++
    if (res.status() >= 400) failures.push(res.status() + ' ' + resource)
  })
  const result = await studio(page, url)
  await page.locator('#dataset').selectOption('sample')
  await page.locator('#dataset').selectOption('full')
  await page.getByText('508 nodes · 746 links', { exact: true }).waitFor()
  assert.equal(snapshots, 1, 'Full graph should be fetched once per session')
  await page.locator('#physics').selectOption('worker')
  await page.waitForFunction(() => {
    document.getElementById('refresh').click()
    return ['transfer', 'shared'].includes(document.getElementById('transport').textContent)
  })
  assert.deepEqual(failures, [])
  console.log({ ...result, worker: await page.locator('#transport').textContent(), snapshotRequests: snapshots })
} finally {
  await browser.close()
}
