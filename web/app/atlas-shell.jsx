'use client'

import { artURL, homeURL, studioURL } from '../site'
import { GraphPicker, graphPaths } from './graph-picker'
import './atlas.css'

export function AtlasShell({ name, children }) {
  return (
    <div className="atlas-app">
      <header className="atlas-mast">
        <a href={homeURL} className="atlas-brand">
          <img src={artURL('loom-logo.png')} alt="" width="22" height="22" />
          Loom
        </a>
        <span aria-hidden="true">/</span>
        <a href={studioURL}>Graph studio</a>
        <GraphPicker value={name.replace(/\/$/, '')} onChange={(key) => location.assign(studioURL + graphPaths[key])} />
      </header>
      {children}
    </div>
  )
}

export function ModeSwitch({ label, value, choices, onChange, disabled = false }) {
  return (
    <fieldset className="atlas-switch" disabled={disabled}>
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
