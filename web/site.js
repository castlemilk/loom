const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '/loom'

export const homeURL = base + '/'
export const siteOrigin = 'https://castlemilk.github.io'
export const studioURL = base + '/studio/'
export const repositoryURL = 'https://github.com/castlemilk/loom'
export const docsURL = homeURL + 'docs/'
export const apiURL = docsURL + 'api/'
export const artURL = (name) => homeURL + 'illustrations/' + name
export const opticsURL = studioURL + '?example=drilldown&group=Optics&bubbles=off'
export const modelURL = homeURL + 'examples/wire-model.json'
export const modelStudioURL = studioURL + '?example=wire-model'

export async function fetchGraphFile(url, signal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Could not load the graph (HTTP ' + response.status + ').')
  return response.json()
}

export const settingsSections = [
  { id: 'explore', label: 'Explore' },
  { id: 'layout', label: 'Layout' },
  { id: 'groups', label: 'Groups' },
  { id: 'style', label: 'Style' },
]
