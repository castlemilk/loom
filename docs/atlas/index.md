# Stream a Wikipedia atlas

Start with a topic map. Fetch article clusters from SQLite as they open, keep a node in view, and load a picture when someone inspects it.

[Open this chapter in Loom](https://castlemilk.github.io/loom/docs/atlas/)

## Open topic blocks on demand

The public Wikispeedia example contains 4,604 articles and 119,882 directed links. Its manifest places the topic hubs and gives aggregate counts before any article blocks load. Opening Music brings 96 articles onto the map.

[Try Music at quarter speed →](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music\&speed=0.25)

In this example, `site` is the root URL of your own static deployment, including its trailing slash. Copy the contents of the package’s `dist/atlas-runtime/` directory to `atlas-runtime/0.8.12/` on that origin. Put the manifest, SQLite database and full JSON snapshot in `examples/wikispeedia/`. Their filenames are recorded in the manifest. The worker must load from the page’s origin. Serve the database with HTTP byte-range support and pass the uncompressed byte count. [Get the demo data](https://github.com/castlemilk/loom/tree/main/web/public/examples/wikispeedia)

`atlas.ts`

```ts
import { parchment } from 'loom-core'
import { createAtlas, createFullAtlasReader, type AtlasManifest } from 'loom-core/atlas'
import { mountAtlasMap } from 'loom-core/atlas-map'
import { createSQLiteAtlasReader } from 'loom-core/atlas-sqlite'

type PublishedAtlas = AtlasManifest & {
  database: string
  databaseBytes: number
  pageSize: number
  full: string
}

export async function openAtlas(canvas: HTMLCanvasElement, site: URL) {
  const data = new URL('examples/wikispeedia/', site)
  const runtime = new URL('atlas-runtime/0.8.12/', site)
  const response = await fetch(new URL('manifest.json', data))
  if (!response.ok) throw new Error('Could not load the atlas manifest')
  const manifest: PublishedAtlas = await response.json()

  const atlas = createAtlas(manifest, {
    'on-demand': () => createSQLiteAtlasReader({
      database: new URL(manifest.database, data),
      databaseBytes: manifest.databaseBytes,
      pageSize: manifest.pageSize,
      worker: new URL('sqlite.worker.js', runtime),
      wasm: new URL('sql-wasm.wasm', runtime),
    }),
    full: () => createFullAtlasReader(new URL(manifest.full, data)),
  })
  try {
    const map = mountAtlasMap(canvas, atlas, {
      theme: parchment, keepView: true, animateLayouts: true, layoutSpeed: 0.25,
      moveMembers: true, memberMotion: 'spring',
    })
    return { atlas, map, close() { map.destroy(); atlas.close() } }
  } catch (error) {
    atlas.close()
    throw error
  }
}
```

## Follow Music into Orbit

The atlas controller owns the open topic IDs and data. Its map owns the camera and motion. Apply a layout to the controller and focus a node through the map. A user can also double-click or double-tap a topic. Panning or choosing Fit view releases the camera.

`follow-music.ts`

```ts
import type { openAtlas } from './atlas.js'

export async function followMusic({ atlas, map }: Awaited<ReturnType<typeof openAtlas>>) {
  // Music is topic 1 in the published Wikispeedia manifest.
  await atlas.setExpanded(new Set([...atlas.getSnapshot().expanded, 1]))
  const { error } = atlas.getSnapshot()
  if (error) throw new Error(error)

  map.focus('topic:1')
  atlas.setLayout('orbit')
  return map.getFollowedNode()
}
```

For an app hosted at `/loom/`, create the session with `await openAtlas(canvas, new URL('/loom/', location.origin))`, then pass it to `await followMusic(session)`.

`map.setLayoutSpeed(0.25)` changes the rate during a move. At quarter speed, the 700 ms transition takes 2.8 seconds. `map.setAnimateLayouts(false)` lands immediately. `map.setSpring({ strength: 0.5, damping: 0.45 })` tunes how far articles trail a dragged topic and how quickly they settle. Call the returned `close()` when the view unmounts.

## Inspect links across topics

`atlasConnections(manifest, topicId)` ranks other topics by incoming and outgoing link counts. Open both topics, then call `atlas.crossings(a, b)` for actual article IDs, titles and directions. The studio loads archived source excerpts separately so the inspector can point to the paragraph that contains the link. [Inspect Mathematics and Computing →](https://castlemilk.github.io/loom/studio/wikispeedia/?connections=mathematics,computing)

For example, the archived Music article links the word “sounds” in its introduction to the Sound article. Open the link below, then choose **Show link on map** to locate both ends. **Permalink to this connection** gives you a URL that reopens the same article pair and passage. [Follow Music → Sound](https://castlemilk.github.io/loom/studio/wikispeedia/?connections=music,science\&edge=74%3A2863)

Compare the readers with `await atlas.setLoading('full')` and `await atlas.setLoading('on-demand')`. The snapshot’s `reads`, `loaded`, `pending` and `error` fields let a host show data costs and retry failed reads. Changing the layout alone reads no new topic blocks.

## Fetch a node image

Request a thumbnail when a node becomes visible or selected. The image source batches concurrent titles, follows redirects and caches both hits and missing images. Its result includes the canonical title and a file-description link for credits. The selection counter below prevents a slow reply from displaying the previous article’s image.

`node-image.ts`

```ts
import { createWikipediaImages } from 'loom-core/wikipedia-images'

export function createArticleInspector() {
  const images = createWikipediaImages()
  let selection = 0

  return {
    async show(title: string, container: HTMLElement) {
      const current = ++selection
      container.replaceChildren()
      const photo = await images.lookup(title)
      if (!photo || current !== selection) return

      const image = new Image()
      image.alt = 'Wikipedia lead image for ' + photo.title
      image.decoding = 'async'
      image.src = photo.src
      const credit = document.createElement('a')
      credit.href = photo.fileUrl
      credit.textContent = 'Image credits'
      try {
        await image.decode()
        if (current === selection) container.replaceChildren(image, credit)
      } catch { /* Keep the article text available if the image fails to load. */ }
    },
    close() { selection++; images.cancel() },
  }
}
```

The studio shares one source between the map, cards and article inspector. Disable **Wikipedia node images** to compare the plain graph. [Open Music without images →](https://castlemilk.github.io/loom/studio/wikispeedia/?topic=music\&images=off)
