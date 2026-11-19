'use client'

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { artURL, settingsSections } from '../site'

const ActiveSection = createContext('explore')

export function SettingsTabs({ children }) {
  const [active, setActive] = useState('explore')
  const controls = useRef(null)
  const requestedPanel = useRef(null)

  function revealControls(id) {
    const aside = controls.current
    const panel = document.getElementById('panel-' + id)
    if (!panel || panel.hidden) return
    const menu = aside.querySelector('[role="tablist"]')
    const top = panel.getBoundingClientRect().top - menu.getBoundingClientRect().height
    if (window.matchMedia('(max-width: 700px)').matches) window.scrollBy({ top, behavior: 'instant' })
    else aside.scrollTop += top - aside.getBoundingClientRect().top
    requestedPanel.current = null
  }

  function show(id, scroll) {
    requestedPanel.current = scroll ? id : null
    setActive(id)
    if (scroll) revealControls(id)
  }

  useLayoutEffect(() => {
    if (requestedPanel.current === active) revealControls(active)
  }, [active])

  useEffect(() => {
    function readLocation(event) {
      const section = settingsSections.find(({ id }) => location.hash === '#settings-' + id)
      const id = section?.id ?? 'explore'
      show(id, !!section)
      if (event && controls.current.contains(document.activeElement)) {
        document.getElementById('tab-' + id).focus({ preventScroll: true })
      }
    }
    readLocation()
    window.addEventListener('hashchange', readLocation)
    return () => window.removeEventListener('hashchange', readLocation)
  }, [])

  function select(id) {
    const hash = '#settings-' + id
    if (id !== active) controls.current.querySelector('details.selected-object')?.removeAttribute('open')
    if (location.hash !== hash) history.pushState(history.state, '', hash)
    show(id, true)
  }

  function move(event, index) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const count = settingsSections.length
    const next = { ArrowLeft: (index + count - 1) % count, ArrowRight: (index + 1) % count, Home: 0, End: count - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    const id = settingsSections[next].id
    document.getElementById('tab-' + id).focus({ preventScroll: true })
    select(id)
  }

  return <aside ref={controls} id="studio-controls" aria-label="Graph controls" className="min-w-0 min-[701px]:overscroll-contain">
    <div role="tablist" aria-label="Graph settings" className="settings-nav">
      {settingsSections.map(({ id, label }, index) => <button key={id} type="button" role="tab" id={'tab-' + id}
        aria-controls={'panel-' + id} aria-selected={active === id} tabIndex={active === id ? 0 : -1}
        onClick={() => select(id)} onKeyDown={(event) => move(event, index)}>
        <img className="settings-art" src={artURL(id + '.webp')} width="35" height="35" alt="" />{label}
      </button>)}
    </div>
    <ActiveSection.Provider value={active}>{children}</ActiveSection.Provider>
  </aside>
}

export function SettingsPanel({ id, children }) {
  const active = useContext(ActiveSection)
  return <div id={'panel-' + id} role="tabpanel" aria-labelledby={'tab-' + id} hidden={id !== active}>{children}</div>
}
