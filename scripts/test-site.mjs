import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { studio } from '../tests/studio.mjs'
import { studioConfiguration } from '../tests/studio-config.mjs'
import { studioLoad } from '../tests/studio-load.mjs'
import { studioDrilldown } from '../tests/studio-drilldown.mjs'
import { fieldGuide } from '../tests/field-guide.mjs'
import { studioMenu } from '../tests/studio-menu.mjs'
import { studioAuthoring } from '../tests/studio-authoring.mjs'

const liveURL = process.argv[2]
const base = (process.env.PAGES_BASE_PATH ?? '/loom') + '/'
const home = liveURL || 'https://loom.test' + base
const url = new URL('studio/', home).href
const root = fileURLToPath(new URL('../web/out/', import.meta.url))
const browser = await chromium.launch({
  channel: process.env.LOOM_BROWSER_CHANNEL,
  args: ['--enable-unsafe-swiftshader'],
})
async function siteContext(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1160, height: 760 }, reducedMotion: 'reduce', ...options })
  if (!liveURL) {
    await context.route('**/*', async (route) => {
      const request = new URL(route.request().url())
      if (request.host !== 'loom.test' || !request.pathname.startsWith(base)) return route.abort()
      const relative = request.pathname.slice(base.length)
      const file = path.resolve(root, relative + (request.pathname.endsWith('/') ? 'index.html' : ''))
      if (!file.startsWith(root)) return route.abort()
      try {
        await route.fulfill({ path: file })
      } catch {
        await route.fulfill({ status: 404, body: 'Missing export asset' })
      }
    })
  }
  return context
}
try {
  const context = await siteContext()
  const desktopMenu = await studioMenu(context, url)
  const mobile = await siteContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const mobileMenu = await studioMenu(mobile, url, true)
  const desktopEdits = await studioAuthoring(context, url)
  const mobileEdits = await studioAuthoring(mobile, url, true)
  await mobile.close()
  console.log({ desktopMenu, mobileMenu, desktopEdits, mobileEdits })
  const guide = await fieldGuide(context, home)
  const drillPage = await context.newPage()
  drillPage.setDefaultTimeout(20000)
  const drilldown = await studioDrilldown(drillPage, url)
  await drillPage.close()
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  const failures = []
  let snapshots = 0
  page.on('response', (res) => {
    const resource = new URL(res.url()).pathname
    if (resource.endsWith('/graphs/knowledge.json')) snapshots++
    if (res.status() >= 400) failures.push(res.status() + ' ' + resource)
  })
  const result = await studio(page, url, (name) => page.getByRole('tab', { name, exact: true }).click())
  await page.locator('#dataset').selectOption('sample')
  await page.locator('#dataset').selectOption('full')
  await page.getByText('508 nodes · 746 links', { exact: true }).waitFor()
  assert.equal(snapshots, 1, 'Full graph should be fetched once per session')
  await page.locator('#blend').focus()
  await page.locator('#blend').press('Home')
  await page.locator('#physics').selectOption('worker')
  await page.locator('#graph').scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    document.getElementById('refresh').click()
    return ['transfer', 'shared'].includes(document.getElementById('transport').textContent) &&
      Number(document.getElementById('ticks').textContent) > 0
  })
  assert.deepEqual(failures, [])
  const worker = await page.locator('#transport').textContent()
  await page.close()
  const configPage = await context.newPage()
  configPage.setDefaultTimeout(15000)
  const configuration = await studioConfiguration(configPage, url)
  const packageHeader = await configPage.evaluate(async ({ home, live, expected }) => {
    const revisionURL = new URL('revision.txt', home)
    if (expected) revisionURL.searchParams.set('sha', expected)
    const revision = live ? (await (await fetch(revisionURL, { cache: 'no-store' })).text()).trim() : ''
    if (live && (!/^[a-f\d]{40}$/.test(revision) || (expected && expected !== revision))) throw new Error('Unexpected package revision')
    const prefix = live ? 'packages/' + revision + '/' : ''
    const response = await fetch(new URL(prefix + 'loom-core-0.1.0.tgz', home))
    if (!response.ok) throw new Error('TypeScript package HTTP ' + response.status)
    return [...new Uint8Array(await response.arrayBuffer()).slice(0, 2)]
  }, { home, live: Boolean(liveURL), expected: process.env.GITHUB_SHA })
  assert.deepEqual(packageHeader, [0x1f, 0x8b], 'Studio should serve the installable npm archive')
  await configPage.close()
  const loadPage = await context.newPage()
  loadPage.setDefaultTimeout(18000)
  const workload = await studioLoad(loadPage, url)
  console.log({ guide, ...result, worker, snapshotRequests: snapshots, configuration, drilldown, workload })
} finally {
  await browser.close()
}
