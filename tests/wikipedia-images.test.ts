import assert from 'node:assert/strict'
import test from 'node:test'
import { createWikipediaImages } from '../src/wikipedia-images.js'

const thumbnail = { source: 'https://upload.wikimedia.org/wikipedia/commons/piano.jpg', width: 250, height: 170 }
test('lead images batch, normalize, follow redirects, cache misses, and retain file credits', async () => {
  const calls: URL[] = []
  const source = createWikipediaImages(async (input, init) => {
    const url = new URL(String(input))
    calls.push(url)
    assert.equal(init?.credentials, 'omit')
    assert.equal(url.searchParams.get('pilicense'), 'free')
    assert.equal(url.searchParams.get('titles'), 'old piano|No photo')
    return Response.json({ query: { normalized: [{ from: 'old piano', to: 'Old piano' }],
      redirects: [{ from: 'Old piano', to: 'Piano' }], pages: [{ title: 'Piano', thumbnail, pageimage: 'Piano A.jpg' }, { title: 'No photo' }] } })
  })
  const first = source.lookup('old_piano')
  assert.equal(first, source.lookup('old piano'))
  const [piano, missing] = await Promise.all([first, source.lookup('No photo')])
  assert.deepEqual(piano, { title: 'Piano', src: thumbnail.source, width: 250, height: 170,
    fileUrl: 'https://en.wikipedia.org/wiki/File:Piano_A.jpg' })
  assert.equal(missing, null)
  assert.equal(await source.lookup('Piano'), piano)
  assert.equal(await source.lookup('No_photo'), null)
  assert.equal(calls.length, 1)
})
test('image queries run serially in bounded batches and back off after rate limiting', async () => {
  let calls = 0, active = 0
  const batches: number[] = []
  const source = createWikipediaImages(async input => {
    assert.equal(++active, 1)
    const titles = new URL(String(input)).searchParams.get('titles')!.split('|')
    batches.push(titles.length)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    return ++calls === 3 ? new Response(null, { status: 429, headers: { 'Retry-After': '30' } })
      : Response.json({ query: { pages: titles.map(title => ({ title })) } })
  })
  await Promise.all(Array.from({ length: 70 }, (_, i) => source.lookup('Article ' + i)))
  assert.deepEqual(batches, [24, 24, 22])
  assert.equal(await source.lookup('Another article'), null)
  assert.equal(calls, 3)
})
test('cancelled or late image results cannot overwrite a later lookup', async () => {
  let release!: () => void, started!: () => void
  const waiting = new Promise<void>(resolve => { started = resolve })
  let count = 0
  const source = createWikipediaImages(async () => {
    if (++count === 1) {
      started()
      await new Promise<void>(resolve => { release = resolve })
      return Response.json({ query: { pages: [{ title: 'Piano' }] } })
    }
    return Response.json({ query: { pages: [{ title: 'Piano', pageimage: 'Piano.jpg', thumbnail }] } })
  })
  const first = source.lookup('Piano')
  await waiting
  source.cancel()
  assert.equal(await first, null)
  const second = source.lookup('Piano')
  release()
  assert.equal((await second)?.src, thumbnail.source)
  source.cancel()
  assert.equal((await source.lookup('Piano'))?.src, thumbnail.source)
  assert.equal(count, 2)
})
