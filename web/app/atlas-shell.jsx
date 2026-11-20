'use client'

import { artURL, homeURL, studioURL } from '../site'
import './atlas.css'

export function AtlasShell({ name, children }) {
  return (
    <div className="atlas-app">
      <header className="atlas-mast">
        <a href={homeURL} className="atlas-brand">
          <img src={artURL('loom-mark.svg')} alt="" width="22" height="22" />
          Loom
        </a>
        <span aria-hidden="true">/</span>
        <a href={studioURL}>Graph studio</a>
        <label>
          Graph{' '}
          <select value={name} onChange={(e) => location.assign(studioURL + e.target.value)}>
            <option value="">Knowledge console</option>
            <optgroup label="Wikipedia atlases">
              <option value="wikispeedia/">Wikispeedia</option>
              <option value="?example=bauhaus">Bauhaus</option>
              <option value="?example=outer-solar-system">Outer Solar System</option>
            </optgroup>
            <option value="cards/">Around Canva · cards</option>
          </select>
        </label>
      </header>
      {children}
    </div>
  )
}

export function ModeSwitch({ label, value, choices, onChange }) {
  return (
    <fieldset className="atlas-switch">
      <legend>{label}</legend>
      <div>
        {choices.map(([id, text]) => (
          <label key={id}>
            <input type="radio" name={label} value={id} checked={value === id} onChange={() => onChange(id)} />
            <span>{text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
