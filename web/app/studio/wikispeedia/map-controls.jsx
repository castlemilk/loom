import { useEffect, useSyncExternalStore } from 'react'
import { atlasLayouts } from '../../../../dist/atlas.js'
import { atlasLayoutSpeed, atlasSpringControls } from '../../../../dist/atlas-map.js'

const names = { published: 'Topic grid', drift: 'Drift', lanes: 'Lanes', orbit: 'Orbit', cloud: '3D Cloud' }
export const layoutHints = {
  published: '',
  drift: 'Linked topics pull closer together.',
  lanes: 'Rows group topics by article count, largest groups first.',
  orbit: 'Topic rings show distance from the most connected topic. Within a topic, articles with more links sit closer to the center.',
  cloud: 'Drag empty space to rotate the cloud.',
}
export function speedFromURL() {
  const value = Number(new URLSearchParams(location.search).get('speed'))
  return value >= atlasLayoutSpeed.min && value <= atlasLayoutSpeed.max
    ? Number((Math.round(value / atlasLayoutSpeed.step) * atlasLayoutSpeed.step).toFixed(2))
    : atlasLayoutSpeed.default
}
function writeSpeedURL(speed) {
  const url = new URL(location.href)
  if (speed === atlasLayoutSpeed.default) url.searchParams.delete('speed')
  else url.searchParams.set('speed', speed)
  if (url.href !== location.href) history.replaceState(history.state, '', url)
}
export function LayoutMenu({ value, onChange, animate, onAnimate, speed, onSpeed }) {
  const reduceMotion = useSyncExternalStore(watchMotion, reduced, () => false)
  const rate = speed + '×'
  useEffect(() => {
    const timer = setTimeout(() => writeSpeedURL(speed), 150)
    return () => clearTimeout(timer)
  }, [speed])
  return (
    <div className="wiki-layout-tools">
      <label className="wiki-layout-picker">
        Layout
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {atlasLayouts.map((key) => (
            <option key={key} value={key}>{names[key]}</option>
          ))}
        </select>
      </label>
      <label className="atlas-check wiki-animate">
        <input type="checkbox" checked={animate && !reduceMotion} disabled={reduceMotion}
          aria-labelledby="wiki-animate-label" aria-describedby={reduceMotion ? 'wiki-animate-reduced' : undefined}
          onChange={(e) => onAnimate(e.target.checked)} />
        <span>
          <span id="wiki-animate-label">Animate layouts</span>
          {reduceMotion && <small id="wiki-animate-reduced">System reduced motion is on</small>}
        </span>
      </label>
      <div className="wiki-speed">
        <label htmlFor="wiki-layout-speed">Layout speed</label>
        <output htmlFor="wiki-layout-speed">{rate}</output>
        <input id="wiki-layout-speed" type="range" min={atlasLayoutSpeed.min} max={atlasLayoutSpeed.max}
          step={atlasLayoutSpeed.step} value={speed} disabled={!animate || reduceMotion}
          aria-valuetext={rate} onChange={e => onSpeed(e.currentTarget.valueAsNumber)}
          onPointerUp={e => writeSpeedURL(e.currentTarget.valueAsNumber)} onKeyUp={e => writeSpeedURL(e.currentTarget.valueAsNumber)} />
      </div>
    </div>
  )
}

export function springFromURL() {
  const params = new URLSearchParams(location.search)
  return Object.fromEntries(
    Object.entries(atlasSpringControls).map(([key, rule]) => {
      const value = Number(params.get(key))
      const valid = Number.isFinite(value) && value >= rule.min && value <= rule.max
      return [
        key,
        valid
          ? Number((rule.min + Math.round((value - rule.min) / rule.step) * rule.step).toFixed(2))
          : rule.default,
      ]
    }),
  )
}
function writeSpringURL(spring) {
  const url = new URL(location.href)
  for (const key of Object.keys(atlasSpringControls)) {
    if (spring[key] !== atlasSpringControls[key].default) url.searchParams.set(key, spring[key])
    else url.searchParams.delete(key)
  }
  if (url.href !== location.href) history.replaceState(history.state, '', url)
}
const motionPreference = () => window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = () => motionPreference().matches
function watchMotion(changed) {
  const query = motionPreference()
  query.addEventListener('change', changed)
  return () => query.removeEventListener('change', changed)
}
const sliders = [
  ['strength', 'Spring strength', 'Longer trail', 'Tighter follow'],
  ['damping', 'Damping', 'More bounce', 'Quicker settle'],
]
export function SpringTuning({ spring, change, enabled }) {
  const reduceMotion = useSyncExternalStore(watchMotion, reduced, () => false)
  useEffect(() => {
    // Wait for a pause in continuous input before updating a shareable URL.
    const timer = setTimeout(() => writeSpringURL(spring), 180)
    return () => clearTimeout(timer)
  }, [spring])
  return (
    <>
      <fieldset
        className="wiki-spring-tuning"
        aria-label="Spring tuning"
        disabled={!enabled || reduceMotion}
        onPointerUp={() => writeSpringURL(spring)}
        onKeyUp={() => writeSpringURL(spring)}
        onBlur={() => writeSpringURL(spring)}
      >
        {sliders.map(([key, label, low, high]) => {
          const id = 'wiki-spring-' + key,
            rule = atlasSpringControls[key]
          const value = key === 'strength' ? spring[key].toFixed(2) + '×' : Math.round(spring[key] * 100) + '%'
          return (
            <div className="wiki-slider" key={key}>
              <div>
                <label htmlFor={id}>{label}</label>
                <output htmlFor={id}>{value}</output>
              </div>
              <input
                id={id}
                type="range"
                min={rule.min}
                max={rule.max}
                step={rule.step}
                value={spring[key]}
                aria-valuetext={value}
                onChange={(e) => change({ ...spring, [key]: Number(e.target.value) })}
              />
              <div className="wiki-slider-ends">
                <span>{low}</span>
                <span>{high}</span>
              </div>
            </div>
          )
        })}
        {sliders.some(([key]) => spring[key] !== atlasSpringControls[key].default) && (
          <button
            type="button"
            className="wiki-reset-tuning"
            onClick={() =>
              change({
                strength: atlasSpringControls.strength.default,
                damping: atlasSpringControls.damping.default,
              })
            }
          >
            Reset tuning
          </button>
        )}
      </fieldset>
      {reduceMotion && enabled && <p className="wiki-motion-note">Reduced motion is on. Articles move together.</p>}
    </>
  )
}
