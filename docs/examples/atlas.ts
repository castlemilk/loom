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
