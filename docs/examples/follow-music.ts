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
