import { build } from 'esbuild'
import { once } from 'node:events'
import { execFileSync, spawn } from 'node:child_process'
import { copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { serveExport } from './serve-export.mjs'
import { tourData } from '../web/showcase/data.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const skill = join(root, '.agents/skills/stageshow')
const scratch = join(root, 'artifacts/showcase/preview')
const publicDir = join(root, 'web/public/showcase')
const sharp = createRequire(new URL('../web/package.json', import.meta.url))('sharp')
const scenes = ['studio', 'sdk', 'mcp']
const sizes = { wide: { width: 704, height: 392 }, compact: { width: 358, height: 320 } }

await mkdir(join(scratch, 'kit'), { recursive: true })
await build({ entryPoints: [join(root, 'web/showcase/preview.jsx')], outfile: join(scratch, 'preview.js'),
  bundle: true, format: 'esm', jsx: 'automatic', target: 'es2022',
  alias: { stageshow: join(skill, 'kit/index.ts'), 'stageshow-clock': join(skill, 'kit/clock.ts'),
    react: join(skill,'node_modules/react'), 'react-dom': join(skill,'node_modules/react-dom') },
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.png': 'dataurl' } })
await Promise.all([
  rename(join(scratch, 'preview.css'), join(scratch, 'kit/stageshow.css')),
  copyFile(join(root, 'web/showcase/scenes.css'), join(scratch, 'scenes.css')),
  writeFile(join(scratch, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loom feature walkthrough</title><link rel="icon" href="/icon.png"><link rel="stylesheet" href="/kit/stageshow.css"><link rel="stylesheet" href="/scenes.css"><main id="scene"></main><script type="module" src="/preview.js"></script></html>'),
  writeFile(join(scratch, 'data.json'), JSON.stringify(await tourData())),
  copyFile(join(root,'web/public/illustrations/graph-mcp.png'), join(scratch,'icon.png')),
])
const preview = process.argv.includes('--preview')
const server = await serveExport('/', preview ? Number(process.env.PORT || 4395) : 0, scratch)
if (preview) {
  console.log('StageShow preview: ' + server.url + '?scene=studio (also sdk and mcp)')
} else {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
  execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' })
  const browser = await chromium.launch({ channel: process.env.LOOM_BROWSER_CHANNEL ?? 'chrome' })
  try {
    await mkdir(publicDir, { recursive: true })
    for (const scene of scenes) for (const [layout, viewport] of Object.entries(sizes)) {
      const name = scene + '-' + layout
      const context = await browser.newContext({ viewport, deviceScaleFactor: layout === 'compact' ? 2 : 1.5, reducedMotion: 'reduce' })
      try {
        const page = await context.newPage()
        const url = server.url + '?scene=' + scene
        await page.goto(url)
        await page.locator('.ss-stage[data-layout="' + layout + '"]').waitFor()
        await page.evaluate(() => document.fonts.ready)
        const poster = await page.screenshot()
        await sharp(poster).webp({ quality: 92 }).toFile(join(scratch, name + '.webp'))
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        await page.goto(url + '&record=1')
        await page.locator('.ss-stage').waitFor({ state: 'attached' })
        await page.evaluate(async () => {
          await document.fonts.ready
          const { clock } = window.__stageshow
          for (let pass = 0; pass < 6 && clock.layoutPending; pass++) await clock.flushLayout()
        })
        await page.locator('.ss-stage[data-layout="' + layout + '"]:not([data-placing]):not([data-offscreen])').waitFor({ state: 'attached' })
        const encoder = spawn(ffmpeg, ['-v','error','-y','-f','image2pipe','-framerate','24','-vcodec','png','-i','pipe:0',
          '-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',join(scratch,name+'.mp4')],
          { stdio: ['pipe','ignore','inherit'] })
        const completed = once(encoder, 'close')
        let pipeError
        encoder.stdin.on('error', error => { pipeError = error })
        try {
          let done = false, lastMark = ''
          const marks = new Set()
          for (let frame = 0; frame < 24 * 18; frame++) {
            const mark = await page.evaluate(async () => {
              const { clock } = window.__stageshow
              await clock.step()
              return document.querySelector('.ss-stage').dataset.mark || ''
            })
            if (mark !== lastMark) {
              if (!mark || marks.has(mark)) throw new Error(name + ' restarted at frame ' + frame)
              marks.add(mark)
              lastMark = mark
            }
            done = mark === 'finished'
            const pixels = await page.screenshot({ scale: 'device', timeout: 8000 })
            if (pipeError) throw pipeError
            if (!encoder.stdin.write(pixels)) await Promise.race([once(encoder.stdin, 'drain'), completed])
            if (done) break
          }
          if (!done) throw new Error(name + ' did not reach its final beat')
          encoder.stdin.end()
          const [code] = await completed
          if (code !== 0) throw new Error('ffmpeg failed to encode ' + name)
        } finally { if (encoder.exitCode === null) encoder.kill() }
        // A correctly framed end still should match the poster, aside from the pointer and H.264 loss.
        const lastFrame = execFileSync(ffmpeg, ['-v','error','-sseof','-0.05','-i',join(scratch,name+'.mp4'),
          '-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'], { maxBuffer: 8 * 1024 * 1024 })
        const [source, decoded] = await Promise.all([poster, lastFrame].map(pixels => sharp(pixels).removeAlpha().resize(160, 100, { fit: 'fill' }).raw().toBuffer()))
        const difference = source.reduce((sum, value, i) => sum + Math.abs(value - decoded[i]), 0) / source.length
        if (difference > 4) throw new Error(name + ' final frame differs from poster (mean channel error ' + difference.toFixed(2) + ')')
        console.log('Recorded ' + name + ' (final-frame error ' + difference.toFixed(2) + ')')
      } finally { await context.close() }
    }
    for (const scene of scenes) for (const layout of Object.keys(sizes)) for (const ext of ['webp','mp4']) {
      const file = scene + '-' + layout + '.' + ext
      await copyFile(join(scratch,file), join(publicDir,file))
    }
  } finally { await browser.close(); server.close() }
}
