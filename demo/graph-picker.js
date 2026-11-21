// Both studios enhance their native select. Its options, grouping and change event stay the source of truth.
const paths = {
  wiki: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0ZM3.4 10h17.2M4.5 16h15M12 3c-5.5 5-5.5 13 0 18 5.5-5 5.5-13 0-18Z',
  bauhaus: 'M3 20h8v-8H3zM15 20h7l-3.5-7zM18.5 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  orbit:
    'M17.5 12a5.5 5.5 0 1 1-11 0 5.5 5.5 0 1 1 11 0Zm-11.2.2c-2.4 1.7-3.7 3.3-3 4.2 1.1 1.7 7.3.3 13.2-2.8 3.4-1.9 5.3-4 4.5-5.1-.5-.9-2.2-.9-4.4-.5',
  cards: 'M2 4h8v7H2zM14 14h8v7h-8zM6 11v3.5a3 3 0 0 0 3 3h5M5 7.5h2M17 17.5h2',
  atlas: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
  wire: 'm3 17 7-14 11 12-8 6-10-4Zm7-14 3 18m-10-4 18-2',
  console:
    'M7.2 9 11 6m2.9.3 4.5 4.3M6.8 12.5 10 17m3.9.8 4.2-4M7.7 10.7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0Zm7-5.7a2 2 0 1 1-4 0 2 2 0 1 1 4 0Zm7 7.3a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 1 1 4.8 0Zm-7.5 6.3a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0Z',
  generated: 'm3 8 9-5 9 5-9 5-9-5Zm0 4.5 9 5 9-5M3 17l9 5 9-5',
  document: 'M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h6',
  check: 'm5 12 4.5 4.5L19 7',
  chevron: 'm7 10 5 5 5-5',
}
const icons = {
  wikispeedia: 'wiki',
  bauhaus: 'bauhaus',
  'outer-solar-system': 'orbit',
  saturn: 'orbit',
  cassini: 'wire',
  cards: 'cards',
  sections: 'atlas',
  model: 'wire',
  sample: 'console',
  full: 'console',
  stress: 'generated',
}
function graphIcon(value) {
  return icons[value] ?? (value.startsWith('count-') ? 'generated' : 'document')
}
function parts(option) {
  const at = option.label.indexOf(' · ')
  if (at < 0 || option.value === 'custom' || option.value.startsWith('draft-')) return [option.label, '']
  return [option.label.slice(0, at), option.label.slice(at + 3)]
}
function icon(name) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg'),
    path = document.createElementNS(ns, 'path')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('data-graph-icon', name)
  path.setAttribute('d', paths[name])
  svg.append(path)
  return svg
}
function span(className, text) {
  const el = document.createElement('span')
  el.className = className
  if (text) el.textContent = text
  return el
}

export function mountGraphPicker(select) {
  const root = select.parentElement
  const trigger = document.createElement('button'),
    list = document.createElement('div')
  const title = span('graph-picker-value'),
    mark = span('graph-picker-mark')
  const events = new AbortController(),
    options = { signal: events.signal }
  const id = select.id
  trigger.type = 'button'
  trigger.id = id + '-choice'
  trigger.className = 'graph-picker-trigger'
  trigger.setAttribute('role', 'combobox')
  trigger.setAttribute('aria-label', 'Graph')
  title.id = id + '-current'
  trigger.setAttribute('aria-describedby', title.id)
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  list.id = id + '-options'
  trigger.setAttribute('aria-controls', list.id)
  trigger.append(mark, title, icon('chevron'))
  list.className = 'graph-picker-list'
  list.hidden = true
  list.setAttribute('role', 'listbox')
  list.setAttribute('aria-label', 'Demo graphs')
  root.append(trigger, list)
  const label = select.labels?.[0]
  function showPicker() {
    select.hidden = true
    trigger.hidden = false
    if (label) label.htmlFor = trigger.id
  }
  // Keep a native menu opened before hydration usable until the user leaves it.
  if (document.activeElement === select) {
    trigger.hidden = true
    select.addEventListener('blur', showPicker, { ...options, once: true })
  } else showPicker()
  let rows = [],
    index = -1,
    keyBuffer = '',
    lastKey = 0,
    shown = ''
  function refresh() {
    const current = select.selectedOptions[0]
    if (!current || shown === current.value + '|' + current.label) return
    shown = current.value + '|' + current.label
    title.textContent = ['sample', 'full'].includes(current.value) ? current.label : parts(current)[0]
    mark.replaceChildren(icon(graphIcon(current.value)))
    trigger.title = current.label
    if (!list.hidden) buildRows()
  }
  function highlight(next, scroll = true) {
    if (!rows.length) return
    rows[index]?.removeAttribute('data-focused')
    index = Math.max(0, Math.min(rows.length - 1, next))
    rows[index].setAttribute('data-focused', '')
    trigger.setAttribute('aria-activedescendant', rows[index].id)
    if (scroll) {
      const box = rows[index].getBoundingClientRect(),
        viewport = list.getBoundingClientRect()
      if (box.bottom > viewport.bottom) list.scrollTop += box.bottom - viewport.bottom + 4
      if (box.top < viewport.top) list.scrollTop -= viewport.top - box.top + 4
    }
  }
  function buildRows() {
    const fragment = document.createDocumentFragment()
    let lastGroup, group
    rows = []
    for (const item of select.options) {
      const parent = item.parentElement
      if (item.disabled || item.hidden || parent.disabled) continue
      if (parent !== lastGroup) {
        group = fragment
        if (parent.tagName === 'OPTGROUP') {
          group = document.createElement('div')
          group.setAttribute('role', 'group')
          group.setAttribute('aria-label', parent.label)
          const heading = span('graph-picker-group', parent.label)
          heading.setAttribute('aria-hidden', 'true')
          group.append(heading)
          fragment.append(group)
        }
        lastGroup = parent
      }
      const row = document.createElement('div'),
        glyph = span('graph-picker-mark')
      row.id = id + '-option-' + rows.length
      row.dataset.value = item.value
      row.setAttribute('role', 'option')
      row.setAttribute('aria-label', item.label)
      row.setAttribute('aria-selected', String(item.selected))
      glyph.append(icon(graphIcon(item.value)))
      const [name, detail] = parts(item)
      row.append(glyph, span('graph-picker-name', name))
      if (detail) row.append(span('graph-picker-detail', detail))
      if (item.selected) row.append(icon('check'))
      group.append(row)
      rows.push(row)
    }
    list.replaceChildren(fragment)
    highlight(
      rows.findIndex((row) => row.dataset.value === select.value),
      false,
    )
  }
  function place() {
    if (list.hidden) return
    const box = trigger.getBoundingClientRect(),
      gap = 5
    const below = innerHeight - box.bottom - 10,
      above = box.top - 10
    const down = below >= Math.min(280, above)
    const width = Math.min(314, innerWidth - 16)
    list.style.width = width + 'px'
    list.style.maxHeight = Math.min(430, down ? below : above) + 'px'
    list.style.left = Math.max(8, Math.min(innerWidth - width - 8, box.right - width)) + 'px'
    list.style.top = (down ? box.bottom + gap : box.top - gap - list.offsetHeight) + 'px'
  }
  function open() {
    if (!list.hidden) return
    list.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    buildRows()
    place()
    highlight(index)
  }
  function close() {
    list.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    trigger.removeAttribute('aria-activedescendant')
    keyBuffer = ''
  }
  function choose(row) {
    close()
    if (!row || select.value === row.dataset.value) return
    select.value = row.dataset.value
    select.dispatchEvent(new Event('input', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))
    refresh()
  }
  trigger.addEventListener('click', () => (list.hidden ? open() : close()), options)
  trigger.addEventListener(
    'keydown',
    (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const k = event.key
      if (k === 'Tab') {
        close()
        return
      }
      if (k === 'Escape' && list.hidden) return
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(k)) {
        event.preventDefault()
        if (k === 'Escape') {
          close()
          return
        }
        if (k === ' ' || k === 'Enter') {
          if (list.hidden) open()
          else choose(rows[index])
          return
        }
        open()
        highlight(k === 'Home' ? 0 : k === 'End' ? rows.length - 1 : index + (k === 'ArrowDown' ? 1 : -1))
      } else if (k.length === 1) {
        event.preventDefault()
        open()
        const now = performance.now()
        keyBuffer = (now - lastKey < 650 ? keyBuffer : '') + k.toLocaleLowerCase()
        lastKey = now
        const match = rows.findIndex((row) =>
          row.getAttribute('aria-label').toLocaleLowerCase().startsWith(keyBuffer),
        )
        if (match >= 0) highlight(match)
      }
    },
    options,
  )
  list.addEventListener('mousedown', (event) => event.preventDefault(), options)
  list.addEventListener(
    'click',
    (event) => {
      const row = event.target.closest('[role=option]')
      if (row) {
        trigger.focus({ preventScroll: true })
        choose(row)
      }
    },
    options,
  )
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!list.hidden && !root.contains(event.target)) close()
    },
    options,
  )
  document.addEventListener(
    'focusin',
    (event) => {
      if (!list.hidden && !root.contains(event.target)) close()
    },
    options,
  )
  window.addEventListener('resize', place, options)
  window.addEventListener(
    'scroll',
    (event) => {
      if (!list.contains(event.target instanceof Node ? event.target : null)) place()
    },
    { ...options, capture: true },
  )
  select.addEventListener('change', refresh, options)
  refresh()
  return {
    refresh,
    destroy() {
      events.abort()
      trigger.remove()
      list.remove()
      select.hidden = false
      if (label) label.htmlFor = id
    },
  }
}
