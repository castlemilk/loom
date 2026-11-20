import type { GraphFrame, LoomGraph, WirePattern } from './types.js'
import type { TaxonGroup, TaxonomyIndex } from './taxonomy.js'
import { cacheOutline, cloudOutline, groupOutline } from './group-outline.js'

export interface BoundaryStyle {
  shape?: 'hull' | 'cloud'
  /** Screen-space padding around each projected node radius. */
  padding?: number
  color?: string
  fillOpacity?: number
  strokeOpacity?: number
  width?: number
  pattern?: WirePattern
}

export interface AnnotationOptions {
  /** Taxonomy id to all its groups, or an explicit list of term ids. */
  bubbles?: Readonly<Record<string, true | readonly string[]>>
  /** Hide every boundary and its canvas hit area while retaining per-taxonomy choices. Defaults to true. */
  bubblesVisible?: boolean
  /** Label visible group boundaries at their upper edge. Labels can open the group. */
  bubbleLabels?: boolean
  padding?: number
  laneTaxonomy?: string
  tooltips?: boolean
  colorFor?: (group: TaxonGroup) => string
  boundary?: BoundaryStyle
  boundaryFor?: (group: TaxonGroup) => BoundaryStyle | undefined
  /** An optional sibling behind a transparent graph canvas, in the same coordinate space. */
  underlay?: HTMLElement
  activeGroup?: { taxonomy: string; id: string; boundary?: 'outline' | 'fade' | 'hide' | 'keep'; shape?: BoundaryStyle['shape'] }
  /** Defaults to double-click. Controls keeps the canvas available for graph gestures. */
  groupGesture?: 'click' | 'double-click' | 'controls'
  /** Called by a lane button or the configured gesture in a visible bubble, after node picking. */
  onOpenGroup?: (group: TaxonGroup) => void
}
export interface GraphAnnotations {
  setOptions(options: Partial<AnnotationOptions>): void
  setIndex(index: TaxonomyIndex): void
  destroy(): void
}
const ns = 'http://www.w3.org/2000/svg'
const badge = 'position:absolute;box-sizing:border-box;background:var(--loom-overlay-bg,#242824);color:var(--loom-overlay-ink,#f4f4eb);font:12px/1.4 var(--loom-overlay-font,system-ui,sans-serif);border:1px solid #8887;border-radius:5px;'

function validate(options: AnnotationOptions) {
  if (options.bubblesVisible !== undefined && typeof options.bubblesVisible !== 'boolean') throw new TypeError('bubblesVisible must be a boolean')
  if (options.bubbleLabels !== undefined && typeof options.bubbleLabels !== 'boolean') throw new TypeError('bubbleLabels must be a boolean')
  const padding = options.padding ?? 9
  if (!Number.isFinite(padding) || padding < 0) throw new RangeError('Invalid bubble padding.')
  if (options.groupGesture !== undefined && !['click', 'double-click', 'controls'].includes(options.groupGesture)) throw new RangeError('Invalid group gesture')
  const policy = options.activeGroup?.boundary
  if (policy !== undefined && !['outline', 'fade', 'hide', 'keep'].includes(policy)) throw new RangeError('Invalid open boundary')
  if (options.boundary) validateStyle(options.boundary)
}
function validateStyle(style: BoundaryStyle) {
  for (const n of [style.padding, style.width]) if (n !== undefined && (!Number.isFinite(n) || n < 0)) throw new RangeError('Invalid boundary size')
  for (const n of [style.fillOpacity, style.strokeOpacity]) if (n !== undefined && (!Number.isFinite(n) || n < 0 || n > 1)) throw new RangeError('Invalid boundary opacity')
  if (style.shape !== undefined && !['hull','cloud'].includes(style.shape)) throw new RangeError('Invalid boundary shape')
  if (style.pattern !== undefined && !['solid','dashed','dotted'].includes(style.pattern)) throw new RangeError('Invalid boundary pattern')
}

/** The host should cover the canvas in the same CSS-pixel coordinate space. */
export function attachAnnotations(graph: Pick<LoomGraph, 'on' | 'onFrame'>, host: HTMLElement, index: TaxonomyIndex, options: AnnotationOptions = {}): GraphAnnotations {
  validate(options)
  const doc = host.ownerDocument
  const root = doc.createElement('div')
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;'
  const svg = doc.createElementNS(ns, 'svg')
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'
  svg.setAttribute('aria-hidden', 'true')
  const captions = doc.createElement('div')
  captions.setAttribute('role', 'list')
  captions.setAttribute('aria-label', 'Graph lanes')
  const tip = doc.createElement('div')
  tip.setAttribute('role', 'tooltip')
  tip.style.cssText = badge + 'padding:7px 10px;max-width:min(270px,95%);overflow-wrap:anywhere;box-shadow:0 3px 14px #0003;'
  tip.hidden = true
  const groupCaptions = doc.createElement('div')
  root.append(svg, groupCaptions, captions, tip)
  host.append(root)
  let destroyed = false
  let frame: GraphFrame | undefined, hovered: string | null = null
  let paths: { group: TaxonGroup; path: SVGPathElement; padding: number; outline: typeof groupOutline;
    geometry: ReturnType<typeof cacheOutline>; revision?: number }[] = []
  let laneMap: GraphFrame['lanes'] | undefined
  let laneTags: { offset: number; tag: HTMLSpanElement }[] = []
  let groupTags = new Map<TaxonGroup, HTMLElement>()
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
    for (const entry of paths) {
      const tag = groupTags.get(entry.group)
      if (view.projectionVersion !== undefined && entry.revision === view.projectionVersion && (!tag || tag.style.left)) continue
      const d = entry.geometry(view.points)
      if (d !== undefined) entry.path.setAttribute('d', d)
      if (tag && (d !== undefined || !tag.style.left)) {
        let top = Infinity, x = 0
        for (const i of entry.group.members) {
          const k = 4*i, y = view.points[k+1] - view.points[k+2] - entry.padding
          if (y < top) { top = y; x = view.points[k] }
        }
        tag.hidden = top < 0 || top > view.height || x < 0 || x > view.width
        tag.style.left = x + 'px'
        tag.style.top = Math.max(23, top) + 'px'
      }
      entry.revision = view.projectionVersion
    }
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
        if (term && options.onOpenGroup) {
          const button = doc.createElement('button')
          button.type = 'button'
          button.textContent = tag.textContent
          button.setAttribute('aria-label', 'Open group ' + term.label)
          button.style.cssText = 'pointer-events:auto;cursor:pointer;font:inherit;color:inherit;background:transparent;border:0;min-height:0;padding:0'
          button.onclick = () => options.onOpenGroup?.(term)
          tag.replaceChildren(button)
        }
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
    const nextPaths: typeof paths = []
    const existing = new Map(paths.map((entry) => [entry.group, entry]))
    const styles: { group: TaxonGroup; policy: 'outline' | 'fade' | 'keep'; style: BoundaryStyle; color: string }[] = []
    for (const group of options.bubblesVisible === false ? [] : index.groups) {
      const active = options.bubbles && Object.hasOwn(options.bubbles, group.taxonomy) && options.bubbles[group.taxonomy]
      if (active !== true && !(active && active.includes(group.id))) continue
      const opened = options.activeGroup
      const policy = opened?.taxonomy === group.taxonomy && opened.id === group.id ? opened.boundary ?? 'outline' : 'keep'
      if (policy === 'hide') continue
      const style = { ...options.boundary, ...options.boundaryFor?.(group) }
      if (opened?.taxonomy === group.taxonomy && opened.id === group.id && opened.shape) style.shape = opened.shape
      validateStyle(style)
      const color = style.color ?? options.colorFor?.(group) ?? group.color
      styles.push({ group, policy, style, color })
    }
    // Evaluate every user rule before touching a live path. Rejected patches leave the current graph intact.
    for (const { group, policy, style, color } of styles) {
      const previous = existing.get(group)
      const path = previous?.path ?? doc.createElementNS(ns, 'path')
      path.dataset.taxonomy = group.taxonomy
      path.dataset.bubble = group.id
      const width = style.width ?? 1
      path.dataset.shape = style.shape ?? 'hull'
      path.setAttribute('fill', color)
      path.setAttribute('stroke', color)
      path.setAttribute('fill-rule', 'evenodd')
      path.setAttribute('fill-opacity', String((style.fillOpacity ?? 0.075) * (policy === 'outline' ? 0 : policy === 'fade' ? 0.2 : 1)))
      path.setAttribute('stroke-opacity', String(style.strokeOpacity ?? 0.57))
      path.setAttribute('stroke-width', String(width))
      path.removeAttribute('stroke-dasharray')
      path.removeAttribute('stroke-linecap')
      if (style.pattern === 'dashed') path.setAttribute('stroke-dasharray', 4 * width + ' ' + 3 * width)
      if (style.pattern === 'dotted') {
        path.setAttribute('stroke-linecap', 'round')
        path.setAttribute('stroke-dasharray', '0 ' + 3 * width)
      }
      const padding = style.padding ?? options.padding ?? 9, outline = style.shape === 'cloud' ? cloudOutline : groupOutline
      nextPaths.push(previous?.padding === padding && previous.outline === outline ? previous :
        { group, path, padding, outline, geometry: cacheOutline(outline, group.members, padding) })
    }
    if (paths.length !== nextPaths.length || nextPaths.some((item, i) => item.path !== paths[i].path)) {
      const fragment = doc.createDocumentFragment()
      for (const item of nextPaths) fragment.append(item.path)
      svg.replaceChildren(fragment)
    }
    if (svg.parentNode !== (options.underlay ?? root)) {
      if (options.underlay) options.underlay.append(svg)
      else root.prepend(svg)
    }
    paths = nextPaths
    const tags = new Map<TaxonGroup, HTMLElement>()
    for (const { group } of options.bubbleLabels ? paths : []) {
      let tag = groupTags.get(group)
      const button = !!options.onOpenGroup
      if (!tag || (tag.tagName === 'BUTTON') !== button) {
        tag = doc.createElement(button ? 'button' : 'span')
        tag.dataset.bubbleLabel = group.id
        tag.style.cssText = badge + 'padding:1px 6px;min-height:18px;max-width:45%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transform:translate(-50%,-100%);'
        tag.textContent = group.label
        if (button) {
          tag.setAttribute('type', 'button')
          tag.style.pointerEvents = 'auto'
          tag.setAttribute('aria-label', 'Browse ' + group.label + ' group')
          tag.onclick = () => options.onOpenGroup?.(group)
        }
      }
      tags.set(group, tag)
    }
    if (tags.size !== groupTags.size || [...tags].some(([g, tag]) => groupTags.get(g) !== tag)) {
      groupCaptions.replaceChildren(...tags.values())
    }
    groupTags = tags
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
    svg.remove()
    root.remove()
  }
  try {
    configure()
    removers.push(graph.onFrame(draw), graph.on('hover', (id) => {
      hovered = id
      showTooltip()
      if (frame) positionTooltip(frame)
    }), graph.on('backgroundclick', ({ x, y, clicks }) => {
      if (!paths.length || !options.onOpenGroup || options.groupGesture === 'controls' || clicks !== (options.groupGesture === 'click' ? 1 : 2)) return
      const point = svg.createSVGPoint()
      point.x = x
      point.y = y
      for (let i = paths.length - 1; i >= 0; i--) {
        const { group, path } = paths[i]
        if (path.isPointInFill(point) || path.isPointInStroke(point)) { options.onOpenGroup(group); return }
      }
    }), graph.on('destroy', destroy))
    doc.addEventListener('keydown', dismiss)
  } catch (error) {
    destroy()
    throw error
  }
  return {
    setIndex(next) {
      if (destroyed) return
      const previous = index
      index = next
      try { configure() } catch (error) { index = previous; throw error }
    },
    setOptions(next) {
      if (destroyed) return
      const updated = { ...options, ...next }
      validate(updated)
      const previous = options
      options = updated
      try { configure() } catch (error) { options = previous; throw error }
    },
    destroy,
  }
}
