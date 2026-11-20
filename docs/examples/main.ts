import { mountSignalPath } from './signal-path.js'

const canvas = document.querySelector<HTMLCanvasElement>('#patch')
if (!canvas) throw new Error('Add a canvas with id="patch" to the page.')
const graph = mountSignalPath(canvas)

window.addEventListener('pagehide', event => {
  if (!event.persisted) graph.destroy()
})
