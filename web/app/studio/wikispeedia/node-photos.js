// The WebGL picking grid supplies both the center and the clickable radius.
// Existing photos move every frame. Discover new ones only after the camera rests.
export function mountNodePhotos(layer, source) {
  const slots = new Map()
  let current, previousScene, ranked, topicPages, timer
  function place(img, i) {
    const { frame, scene } = current, k = i * 4
    const x = frame.points[k], y = frame.points[k + 1], r = frame.points[k + 2]
    const radius = scene.nodes[i].kind === 'topic' ? Math.min(31, r - 1) : Math.min(21, r + 3)
    img.style.width = img.style.height = Math.max(0, radius * 2) + 'px'
    img.style.transform = 'translate(' + (x - radius) + 'px,' + (y - radius) + 'px)'
  }
  function reconcile() {
    timer = undefined
    const { scene, indices, frame, active, selected } = current
    const hub = indices.get('topic:' + active), article = indices.get(selected)
    const desired = new Map(), occupied = [], limit = frame.width < 550 ? 5 : 9
    function consider(i) {
      if (i === undefined || desired.has(i)) return
      const node = scene.nodes[i], x = frame.points[4 * i], y = frame.points[4 * i + 1]
      if (x < 10 || y < 10 || x > frame.width - 10 || y > frame.height - 10) return
      if (node.kind === 'topic' && !topicPages.has(node.topic)) return
      if (occupied.some(p => Math.hypot(p.x - x, p.y - y) < 45 || p.title === node.label)) return
      occupied.push({ x, y, title: node.label })
      desired.set(i, node)
    }
    consider(article)
    consider(hub)
    if (frame.zoom >= 1.6) for (const i of ranked) {
      consider(i)
      if (desired.size >= limit) break
    }
    const keep = new Set()
    for (const [i, node] of desired) {
      keep.add(node.id)
      if (slots.has(node.id)) continue
      const slot = {}
      slots.set(node.id, slot)
      source.lookup(node.label).then(photo => {
        if (!photo || slots.get(node.id) !== slot) return
        const img = new Image()
        img.alt = ''
        img.decoding = 'async'
        img.dataset.nodePhoto = node.id
        img.onload = () => {
          const index = current.indices.get(node.id)
          if (slots.get(node.id) !== slot || index === undefined) return
          place(img, index)
          layer.append(img)
        }
        slot.img = img
        img.src = photo.src
      })
    }
    for (const [id, slot] of slots) if (!keep.has(id)) {
      slot.img?.remove()
      slots.delete(id)
    }
  }
  return {
    paint(frame, scene, indices, active, selected, moving) {
      if (scene !== previousScene) {
        previousScene = scene
        ranked = []
        const hubs = new Map()
        topicPages = new Set()
        scene.nodes.forEach((node, i) => {
          if (node.article === undefined) hubs.set(node.topic, node.label)
          else {
            ranked.push(i)
            if (node.label === hubs.get(node.topic)) topicPages.add(node.topic)
          }
        })
        ranked.sort((a, b) => scene.nodes[b].degree - scene.nodes[a].degree)
      }
      const changed = !current || current.scene !== scene || current.frame.projectionVersion !== frame.projectionVersion ||
        current.selected !== selected || current.active !== active || current.moving !== moving
      current = { frame, scene, indices, active, selected, moving }
      if (!changed) return
      for (const [id, slot] of slots) {
        const i = indices.get(id)
        if (i === undefined) { slot.img?.remove(); slots.delete(id) }
        else if (slot.img) place(slot.img, i)
      }
      clearTimeout(timer)
      if (!moving) timer = setTimeout(reconcile, 120)
    },
    destroy() {
      clearTimeout(timer)
      slots.clear()
      layer.replaceChildren()
    },
  }
}
