import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { serve } from './serve.mjs'
import { measure } from './measure.mjs'
import { studio } from '../tests/studio.mjs'

const bench = process.argv.includes('--bench'),
  update = process.argv.includes('--update-golden')
const out = new URL('../artifacts/', import.meta.url)
await mkdir(out, { recursive: true })
const sites = []
let browser
const report = {}
try {
  sites.push(await serve(0, true))
  sites.push(await serve(0, false))
  browser = await chromium.launch({
    headless: process.env.LOOM_HEADFUL !== '1',
    args: bench ? [] : ['--enable-unsafe-swiftshader'],
  })
  async function run(name, args = [], options = {}) {
    const ctx = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 1,
      reducedMotion: bench ? 'no-preference' : 'reduce',
    })
    const page = await ctx.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    try {
      await page.goto(sites[options.isolated === false ? 1 : 0].url + '/tests/blank.html')
      const result = await page.evaluate(
        async ([n, a]) => (await import('/tests/browser-scenarios.mjs'))[n](...a),
        [name, args],
      )
      assert.deepEqual(errors, [])
      return result
    } finally {
      await ctx.close()
    }
  }
  if (!bench) {
    const studioCtx = await browser.newContext({
      viewport: { width: 1160, height: 760 },
      reducedMotion: 'reduce',
    })
    try {
      report.studio = await studio(await studioCtx.newPage(), sites[0].url + '/demo/')
    } finally {
      await studioCtx.close()
    }
    report.lifecycle = await run('lifecycle')
    report.contextAndArt = await run('contextAndArt')
    report.shared = await run('worker', ['shared'])
    report.transfer = await run('worker', ['transfer'], { isolated: false })
    report.styledGeometry = await run('styledGeometry')
    report.dragPin = await run('dragPin')
    report.springMain = await run('springDrag', ['main'])
    report.springShared = await run('springDrag', ['shared'])
    report.springTransfer = await run('springDrag', ['transfer'], { isolated: false })
    report.reducedDrag = await run('springDrag', ['main', true])
    report.cloudDrag = await run('cloudDrag')
    report.hybridMain = await run('hybrid', ['main'])
    report.hybridShared = await run('hybrid', ['shared'])
    report.hybridTransfer = await run('hybrid', ['transfer'], { isolated: false })
    const actual = await run('golden'),
      baseline = new URL('../tests/golden.png', import.meta.url)
    await writeFile(new URL('golden-actual.png', out), Buffer.from(actual, 'base64'))
    if (update) await writeFile(baseline, Buffer.from(actual, 'base64'))
    const expected = (await readFile(baseline)).toString('base64')
    report.golden = await run('compareGolden', [actual, expected])
  } else {
    Object.assign(report, await measure(browser, run, sites[0].url))
    if (report.failures.length) process.exitCode = 1
  }
} catch (error) {
  report.error = String(error.stack ?? error)
  process.exitCode = 1
} finally {
  console.log(JSON.stringify(report, null, 2))
  await writeFile(
    new URL(bench ? 'performance.json' : 'browser.json', out),
    JSON.stringify(report, null, 2) + '\n',
  )
  await browser?.close()
  for (const { server } of sites) server.close()
}
