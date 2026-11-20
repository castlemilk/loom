/** A current, freely licensed Wikipedia lead image and its file description with credits. */
export interface WikipediaImage {
  title: string
  src: string
  width: number
  height: number
  fileUrl: string
}

type Result = WikipediaImage | null
type Job = { promise: Promise<Result>; finish: (value: Result) => void }
interface Page {
  title: string
  pageimage?: string
  thumbnail?: { source: string; width: number; height: number }
}
interface Query {
  pages: Page[]
  normalized?: { from: string; to: string }[]
  redirects?: { from: string; to: string }[]
}
const keyFor = (title: string) => title.replaceAll('_', ' ').trim().normalize('NFC')
function imageOf(page: Page): Result {
  const thumb = page.thumbnail
  if (!thumb || !page.pageimage || !/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(thumb.source)) return null
  return { title: page.title, src: thumb.source, width: thumb.width, height: thumb.height,
    fileUrl: 'https://en.wikipedia.org/wiki/File:' + encodeURIComponent(page.pageimage.replaceAll(' ', '_')) }
}

/** Coalesce concurrent lookups into serial MediaWiki PageImages requests. Missing images resolve to null. */
export function createWikipediaImages(request: typeof fetch = fetch) {
  const cache = new Map<string, { value: Result; until: number }>()
  const pending = new Map<string, Job>(), queue = new Set<string>()
  let active: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined
  let retryAfter = 0

  function cacheResult(key: string, value: Result) {
    cache.delete(key)
    if (cache.size >= 512) cache.delete(cache.keys().next().value!)
    cache.set(key, { value, until: Date.now() + (value ? 24 : 1) * 3600_000 })
  }
  function resolve(key: string, value: Result) {
    pending.get(key)?.finish(value)
    pending.delete(key)
  }
  function schedule() {
    if (!active && !timer && queue.size) timer = setTimeout(run, 40)
  }
  async function run() {
    timer = undefined
    const batch = [...queue].slice(0, 24), controller = new AbortController()
    for (const key of batch) queue.delete(key)
    active = controller
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const url = new URL('https://en.wikipedia.org/w/api.php')
      url.search = new URLSearchParams({ action: 'query', prop: 'pageimages', format: 'json', formatversion: '2',
        piprop: 'name|thumbnail', pilicense: 'free', pithumbsize: '250', pilimit: '50', redirects: '1',
        origin: '*', maxage: '3600', titles: batch.join('|') }).toString()
      const response = await request(url, { signal: controller.signal, credentials: 'omit',
        headers: { 'Api-User-Agent': 'LoomStudio/0.1 (https://github.com/castlemilk/loom)' } })
      if (active !== controller) return
      if (!response.ok) {
        const wait = response.headers.get('Retry-After')
        if (wait) {
          const deadline = Number.isFinite(Number(wait)) ? Date.now() + Number(wait) * 1000 : Date.parse(wait)
          if (Number.isFinite(deadline)) retryAfter = deadline
        }
        throw new Error('Wikipedia image request failed')
      }
      const { query }: { query?: Query } = await response.json()
      if (active !== controller) return
      if (!Array.isArray(query?.pages)) throw new Error('Wikipedia images unavailable')
      const aliases = new Map([...(query.normalized ?? []), ...(query.redirects ?? [])].map(a => [a.from, a.to]))
      const pages = new Map(query.pages.map(page => [page.title, imageOf(page)]))
      for (const key of batch) {
        let title = key
        for (let i = 0; aliases.has(title) && i < aliases.size; i++) title = aliases.get(title)!
        const value = pages.get(title) ?? null
        cacheResult(key, value)
        if (title !== key) cacheResult(title, value)
        resolve(key, value)
      }
    } catch {
      if (active !== controller) return
      // A transport failure is transient. Keep it separate from a page with no picture.
      retryAfter = Math.max(retryAfter, Date.now() + 15_000)
      for (const key of pending.keys()) resolve(key, null)
      queue.clear()
    } finally {
      clearTimeout(timeout)
      if (active === controller) {
        active = undefined
        schedule()
      }
    }
  }
  return {
    lookup(title: string): Promise<Result> {
      const key = keyFor(title), cached = cache.get(key)
      if (cached && cached.until > Date.now()) return Promise.resolve(cached.value)
      if (!key || key.length > 255 || key.includes('|') || Date.now() < retryAfter) return Promise.resolve(null)
      let job = pending.get(key)
      if (!job) {
        let finish!: Job['finish']
        const promise = new Promise<Result>(resolve => { finish = resolve })
        job = { promise, finish }
        pending.set(key, job)
        queue.add(key)
        schedule()
      }
      return job.promise
    },
    /** Cancel outstanding demand. Completed results stay available when images are enabled again. */
    cancel() {
      clearTimeout(timer)
      timer = undefined
      active?.abort()
      active = undefined
      for (const key of pending.keys()) resolve(key, null)
      queue.clear()
    },
  }
}
