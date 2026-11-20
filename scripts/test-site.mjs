import { chooseGraph, studioPicker } from '../tests/graph-picker.mjs'
import assert from 'node:assert/strict'
import { serveExport } from './serve-export.mjs'
import { archiveName } from './npm-registry.mjs'
import { chromium } from 'playwright'
import { studio } from '../tests/studio.mjs'
import { studioConfiguration } from '../tests/studio-config.mjs'
import { studioLoad } from '../tests/studio-load.mjs'
import { studioDrilldown } from '../tests/studio-drilldown.mjs'
import { fieldGuide } from '../tests/field-guide.mjs'
import { sdkDocs } from '../tests/sdk-docs.mjs'
import { exampleJourney, searchPages } from '../tests/site-discovery.mjs'
import { studioMenu } from '../tests/studio-menu.mjs'
import { studioAuthoring } from '../tests/studio-authoring.mjs'
import { studioExport } from '../tests/studio-export.mjs'
import { studioWires } from '../tests/studio-wires.mjs'
import { studioAtlases } from '../tests/studio-atlases.mjs'
import { studioProgressive } from '../tests/studio-progressive.mjs'
import { studioConnections, studioTopicLayout, studioTopicMotion } from '../tests/studio-topic-layout.mjs'
import { studioAtlasControls } from '../tests/studio-atlas-controls.mjs'
import { studioAtlasNavigation } from '../tests/studio-atlas-navigation.mjs'
import { studioWikipediaImages } from '../tests/studio-wikipedia-images.mjs'

const liveURL = process.argv[2]
const base = (process.env.PAGES_BASE_PATH ?? '/loom') + '/'
const local = liveURL ? null : await serveExport(base)
const home = liveURL || local.url
const url = new URL('studio/', home).href
const browser = await chromium.launch({
  channel: process.env.LOOM_BROWSER_CHANNEL,
  args: ['--enable-unsafe-swiftshader'],
})
function siteContext(options = {}) {
  return browser.newContext({ viewport: { width: 1160, height: 760 }, reducedMotion: 'reduce', ...options })
}
try {
  const context = await siteContext()
  const desktopMenu = await studioMenu(context, url)
  const mobile = await siteContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  console.log(await searchPages(browser, home))
  await exampleJourney(context, home)
  await exampleJourney(mobile, home, true)
  const docs = await sdkDocs(context, home)
  const mobileDocs = await sdkDocs(mobile, home, true)
  console.log({ docs, mobileDocs })
  const mobileMenu = await studioMenu(mobile, url, true)
  const desktopEdits = await studioAuthoring(context, url)
  const mobileEdits = await studioAuthoring(mobile, url, true)
  console.log(await studioExport(context, url, { live: !!liveURL }), await studioExport(mobile, url, { touch: true, live: !!liveURL }))
  const wires = await studioWires(context, url)
  const desktopAtlases = await studioAtlases(context, home)
  const mobileAtlases = await studioAtlases(mobile, home, true)
  const progressive = await studioProgressive(context, home)
  const mobileProgressive = await studioProgressive(mobile, home, true)
  const topicLayout = await studioTopicLayout(context, home)
  const mobileTopicLayout = await studioTopicLayout(mobile, home, true)
  const spring = await studioTopicMotion(context, home)
  const mobileSpring = await studioTopicMotion(mobile, home, true)
  const tuning = await studioAtlasControls(context, home)
  const mobileTuning = await studioAtlasControls(mobile, home, true)
  const navigation = await studioAtlasNavigation(context, home)
  const mobileNavigation = await studioAtlasNavigation(mobile, home, true)
  const images = await studioWikipediaImages(context, home)
  const mobileImages = await studioWikipediaImages(mobile, home, true)
  const connections = await studioConnections(context, home)
  const mobileConnections = await studioConnections(mobile, home, true)
  await studioPicker(context, home, false)
  await studioPicker(mobile, home, true)
  await mobile.close()
  console.log({ desktopMenu, mobileMenu, desktopEdits, mobileEdits, wires, desktopAtlases, mobileAtlases, progressive, mobileProgressive, topicLayout, mobileTopicLayout, spring, mobileSpring, tuning, mobileTuning, navigation, mobileNavigation, images, mobileImages, connections, mobileConnections })
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
  await chooseGraph(page, 'sample')
  await chooseGraph(page, 'full')
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
  const packageHeader = await configPage.evaluate(async ({ home, live, expected, archiveName }) => {
    const revisionURL = new URL('revision.txt', home)
    if (expected) revisionURL.searchParams.set('sha', expected)
    const revision = live ? (await (await fetch(revisionURL, { cache: 'no-store' })).text()).trim() : ''
    if (live && (!/^[a-f\d]{40}$/.test(revision) || (expected && expected !== revision))) throw new Error('Unexpected package revision')
    const prefix = live ? 'packages/' + revision + '/' : ''
    const response = await fetch(new URL(prefix + archiveName, home))
    if (!response.ok) throw new Error('TypeScript package HTTP ' + response.status)
    return [...new Uint8Array(await response.arrayBuffer()).slice(0, 2)]
  }, { home, live: Boolean(liveURL), expected: process.env.GITHUB_SHA, archiveName })
  assert.deepEqual(packageHeader, [0x1f, 0x8b], 'Studio should serve the installable npm archive')
  await configPage.close()
  const loadPage = await context.newPage()
  loadPage.setDefaultTimeout(18000)
  const workload = await studioLoad(loadPage, url)
  console.log({ guide, ...result, worker, snapshotRequests: snapshots, configuration, drilldown, workload })
} finally {
  await browser.close()
  local?.close()
}
