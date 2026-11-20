import { transferHandlers, wrap } from 'comlink'
import type { AtlasBlock, AtlasReader, AtlasReads } from './atlas.js'

interface Database {
  exec(query: string, params: readonly number[]): Promise<{ values: (number | string)[][] }[]>
}
interface SqlWorker {
  SplitFileHttpDatabase(wasm: string, configs: object[]): Promise<Database>
  getStats(): Promise<{ totalFetchedBytes: number; totalRequests: number }>
}
export interface AtlasSQLiteOptions {
  database: string | URL
  /** Uncompressed database size. Supply this when the host may compress HEAD responses. */
  databaseBytes?: number
  worker: string | URL
  wasm: string | URL
  pageSize: number
}

/** Range-read the atlas schema in a dedicated SQLite/WASM worker. No worker or WASM is loaded until read(). */
export function createSQLiteAtlasReader(options: AtlasSQLiteOptions): AtlasReader {
  if (
    options.databaseBytes !== undefined &&
    (!Number.isSafeInteger(options.databaseBytes) ||
      options.databaseBytes <= 0 ||
      options.databaseBytes % options.pageSize !== 0)
  )
    throw new RangeError('Atlas database length must be a positive whole number of SQLite pages')
  let worker: Worker | undefined, ready: Promise<Database> | undefined
  let remote: SqlWorker | undefined,
    closed = false
  const interrupted = new Set<(reason: Error) => void>()
  let reads: AtlasReads = { bytes: 0, requests: 0 }
  function stop(reason: Error) {
    worker?.terminate()
    worker = undefined
    ready = undefined
    remote = undefined
    for (const reject of interrupted) reject(reason)
    interrupted.clear()
  }
  function connect() {
    if (closed) throw new Error('Atlas reader is closed')
    if (ready) return ready
    // The prebuilt worker uses the Comlink 4.3.0 numeric protocol and returns
    // its database on a dedicated message port.
    if (!transferHandlers.has('WORKERSQLPROXIES'))
      transferHandlers.set('WORKERSQLPROXIES', {
        canHandle: (_): _ is never => false,
        serialize() {
          throw new Error('Database handles are received from the worker')
        },
        deserialize(value) {
          const port = value as MessagePort
          port.start()
          return wrap<Database>(port)
        },
      })
    worker = new Worker(options.worker, { name: 'Loom SQLite atlas' })
    worker.addEventListener('error', () =>
      stop(new Error('Could not start the SQLite worker. Retry or use All at once.')),
    )
    remote = wrap<SqlWorker>(worker) as SqlWorker
    const absolute = (url: string | URL) => new URL(url, location.href).href
    const database = new URL(absolute(options.database))
    // httpvfs accepts a known length in its chunked configuration. Treat the file
    // as one server chunk. Its virtual chunk number goes in the URL fragment so
    // every ranged GET uses the original path and query, including signed URLs.
    database.hash = ''
    const config =
      options.databaseBytes === undefined
        ? { serverMode: 'full', url: database.href, requestChunkSize: options.pageSize }
        : {
            serverMode: 'chunked',
            urlPrefix: database.href + '#part=',
            suffixLength: 1,
            serverChunkSize: options.databaseBytes,
            databaseLengthBytes: options.databaseBytes,
            requestChunkSize: options.pageSize,
          }
    ready = remote.SplitFileHttpDatabase(absolute(options.wasm), [
      {
        from: 'inline',
        virtualFilename: 'graph.sqlite',
        config,
      },
    ])
    return ready
  }
  return {
    async read(ids) {
      if (!ids.length) return []
      const topics = new Map(ids.map((topic) => [topic, { topic, articles: [], edges: [] } as AtlasBlock]))
      let cancel!: (reason: Error) => void
      const stopped = new Promise<never>((_, reject) => {
        cancel = reject
      })
      interrupted.add(cancel)
      const query = async () => {
        const db = await connect(),
          args = ids.map(() => '?').join(',')
        const [articles] = await db.exec(
          'SELECT topic,id,title,degree FROM articles WHERE topic IN (' + args + ') ORDER BY topic,id',
          ids,
        )
        const [edges] = await db.exec(
          'SELECT topic,source,target FROM edges WHERE topic IN (' + args + ') ORDER BY topic,source,target',
          ids,
        )
        for (const [topic, id, title, degree] of articles?.values ?? [])
          topics.get(Number(topic))!.articles.push([Number(id), String(title), Number(degree)])
        for (const [topic, source, target] of edges?.values ?? [])
          topics.get(Number(topic))!.edges.push([Number(source), Number(target)])
        const stats = await remote!.getStats()
        // httpvfs 0.8.12 counts end-start per GET. HTTP range endpoints are inclusive.
        reads = { bytes: stats.totalFetchedBytes + stats.totalRequests, requests: stats.totalRequests }
        return [...topics.values()]
      }
      try {
        return await Promise.race([query(), stopped])
      } catch (cause) {
        stop(cause instanceof Error ? cause : new Error(String(cause)))
        throw cause
      } finally {
        interrupted.delete(cancel)
      }
    },
    stats: () => reads,
    close() {
      closed = true
      stop(new Error('Atlas reader closed'))
    },
  }
}
