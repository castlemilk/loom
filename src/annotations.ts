import type { GraphFrame, LoomGraph } from './types.js'
import type { TaxonGroup, TaxonomyIndex } from './taxonomy.js'
import { groupOutline } from './group-outline.js'

export interface AnnotationOptions {
  /** Taxonomy id to all its groups, or an explicit list of term ids. */
  bubbles?: Readonly<Record<string, true | readonly string[]>>
  padding?: number
  laneTaxonomy?: string
  tooltips?: boolean
  colorFor?: (group: TaxonGroup) => string
}
export interface GraphAnnotations {
  setOptions(options: Partial<AnnotationOptions>): void
  setIndex(index: TaxonomyIndex): void
  destroy(): void
}
const ns = 'http://www.w3.org/2000/svg'
const badge = 'position:absolute;box-sizing:border-box;background:var(--loom-overlay-bg,#242824);color:var(--loom-overlay-ink,#f4f4eb);font:12px/1.4 var(--loom-overlay-font,system-ui,sans-serif);border:1px solid #8887;border-radius:5px;'

/** The host should cover the canvas in the same CSS-pixel coordinate space. */
export function attachAnnotations(graph: LoomGraph, host: HTMLElement, index: TaxonomyIndex, options: AnnotationOptions = {}): GraphAnnotations {
  const doc = host.ownerDocument
  const root = doc.createElement('div')
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;'
  const svg = doc.createElementNS(ns, 'svg')
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
  svg.setAttribute('aria-hidden', 'true')
  const captions = doc.createElement('div')
  captions.setAttribute('role', 'list')
  captions.setAttribute('aria-label', 'Graph lanes')
  const tip = doc.createElement('div')
  tip.setAttribute('role', 'tooltip')
  tip.style.cssText = badge + 'padding:7px 10px;max-width:min(270px,95%);overflow-wrap:anywhere;box-shadow:0 3px 14px #0003;'
  tip.hidden = true
  root.append(svg, captions, tip)
  host.append(root)
  let destroyed = false
  let frame: GraphFrame | undefined, hovered: string | null = null
  let paths: { members: readonly number[]; path: SVGPathElement }[] = []
  let laneMap: GraphFrame['lanes'] | undefined
  let laneTags: { offset: number; tag: HTMLSpanElement }[] = []
  const removers: (() => void)[] = []

  function showTooltip() {
    const content = options.tooltips !== false && hovered !== null ? index.tooltip(hovered) : undefined
    tip.hidden = !content
    tip.replaceChildren()
    if (!content) return
    const title = doc.createElement('strong')
    title.textContent = content.title
    tip.append(title)
    for (const text of content.lines) {
      const line = doc.createElement('div')
      line.textContent = text
      tip.append(line)
    }
  }
  function positionTooltip(view: GraphFrame) {
    const i = hovered === null || options.tooltips === false ? undefined : index.nodeIndex(hovered)
    if (i === undefined || !tip.firstChild) return
    const k = i * 4, x = view.points[k], y = view.points[k + 1], r = view.points[k + 2] + 6
    tip.hidden = x < 0 || y < 0 || x > view.width || y > view.height
    if (tip.hidden) return
    const w = tip.offsetWidth, h = tip.offsetHeight
    tip.style.left = Math.max(3, Math.min(view.width - w - 3, x + r + w <= view.width ? x + r : x - r - w)) + 'px'
    tip.style.top = Math.max(3, Math.min(y - h / 2, view.height - h - 3)) + 'px'
  }
  function draw(view: GraphFrame) {
    frame = view
    for (const { members, path } of paths) path.setAttribute('d', groupOutline(view.points, members, options.padding ?? 9))
    const lanes = view.mode === 'lanes' && options.laneTaxonomy ? view.lanes : undefined
    if (lanes !== laneMap) {
      laneMap = lanes
      captions.replaceChildren()
      laneTags = []
      const terms = new Map(index.legend(options.laneTaxonomy ?? '').map((term) => [term.id, term]))
      lanes?.forEach((offset, id) => {
        const term = terms.get(id), tag = doc.createElement('span')
        tag.dataset.lane = id
        tag.setAttribute('role', 'listitem')
        tag.textContent = term?.label ?? (id || index.ungrouped)
        tag.title = tag.textContent
        tag.style.cssText = badge + 'padding:2px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-inline-start-width:3px;'
        tag.style.borderInlineStartColor = term ? options.colorFor?.(term) ?? term.color : '#999'
        captions.append(tag)
        laneTags.push({ offset, tag })
      })
    }
    const gap = laneTags.length > 1 ? Math.abs(laneTags[1].offset - laneTags[0].offset) * view.zoom : view.width
    for (const { offset, tag } of laneTags) {
      const axis = view.laneOrigin + offset * view.zoom
      tag.hidden = axis < 0 || axis > (view.vertical ? view.height : view.width)
      tag.style.maxWidth = (view.vertical ? Math.min(160, view.width / 3) : Math.max(18, Math.min(190, gap - 4))) + 'px'
      tag.style.left = (view.vertical ? 8 : axis) + 'px'
      tag.style.top = (view.vertical ? axis : 9) + 'px'
      tag.style.transform = view.vertical ? 'translateY(-50%)' : 'translateX(-50%)'
    }
    positionTooltip(view)
  }
  function configure() {
    const padding = options.padding ?? 9
    if (!Number.isFinite(padding) || padding < 0) throw new RangeError('Invalid bubble padding.')
    svg.replaceChildren()
    paths = []
    for (const group of index.groups) {
      const active = options.bubbles && Object.hasOwn(options.bubbles, group.taxonomy) && options.bubbles[group.taxonomy]
      if (active !== true && !(active && active.includes(group.id))) continue
      const path = doc.createElementNS(ns, 'path')
      path.dataset.taxonomy = group.taxonomy
      path.dataset.bubble = group.id
      const color = options.colorFor?.(group) ?? group.color
      path.setAttribute('fill', color)
      path.setAttribute('stroke', color)
      path.setAttribute('fill-opacity', '0.075')
      path.setAttribute('stroke-opacity', '0.57')
      svg.append(path)
      paths.push({ members: group.members, path })
    }
    laneMap = undefined
    captions.replaceChildren()
    laneTags = []
    showTooltip()
    if (frame) draw(frame)
  }
  function dismiss(event: KeyboardEvent) {
    if (event.key === 'Escape') { hovered = null; showTooltip() }
  }
  function destroy() {
    if (destroyed) return
    destroyed = true
    for (const remove of removers) remove()
    doc.removeEventListener('keydown', dismiss)
    root.remove()
  }
  try {
    configure()
    removers.push(graph.onFrame(draw), graph.on('hover', (id) => {
      hovered = id
      showTooltip()
      if (frame) positionTooltip(frame)
    }), graph.on('destroy', destroy))
    doc.addEventListener('keydown', dismiss)
  } catch (error) {
    destroy()
    throw error
  }
  return {
    setIndex(next) { if (!destroyed) { index = next; configure() } },
    setOptions(next) { if (!destroyed) { options = { ...options, ...next }; configure() } },
    destroy,
  }
}
