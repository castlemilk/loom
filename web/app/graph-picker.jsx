'use client'

import { useLayoutEffect, useRef } from 'react'
import { mountGraphPicker } from '../../demo/graph-picker'
import '../../demo/graph-picker.css'

const groups = [
  ['Create a graph', [['blank', 'Blank canvas', '?example=blank']]],
  [
    'Wikipedia atlases',
    [
      ['wikispeedia', 'Wikispeedia · 4,604 articles', 'wikispeedia/'],
      ['bauhaus', 'Bauhaus · 15 articles', '?example=bauhaus'],
      ['outer-solar-system', 'Outer Solar System · 16 articles', '?example=outer-solar-system'],
    ],
  ],
  [
    'Graph studies',
    [
      ['cards', 'Around Canva · cards', 'cards/'],
      ['model', 'Wire model', '?example=wire-model'],
      ['sections', 'Section atlas', '?example=clusters'],
    ],
  ],
  [
    'Knowledge console',
    [
      ['sample', 'Knowledge console · excerpt', ''],
      ['full', 'Knowledge console · full', '?example=full'],
    ],
  ],
  ['Generated graphs', [['stress', 'Generated stress graph', '?example=stress']]],
]
export const graphPaths = Object.fromEntries(
  groups.flatMap(([, entries]) => entries.map(([id, , path]) => [id, path])),
)

export function GraphPicker({ value, onChange, children }) {
  const select = useRef(null),
    picker = useRef(null)
  useLayoutEffect(() => {
    picker.current = mountGraphPicker(select.current)
    return () => {
      picker.current.destroy()
      picker.current = null
    }
  }, [])
  useLayoutEffect(() => {
    picker.current?.refresh()
  }, [value, children])
  return (
    <div className="dataset">
      <label htmlFor="dataset">Graph</label>
      <div className="graph-picker">
        <select ref={select} id="dataset" value={value} onChange={(event) => onChange(event.target.value)}>
          {groups.map(([label, items]) => (
            <optgroup key={label} label={label}>
              {items.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </optgroup>
          ))}
          {children}
        </select>
      </div>
    </div>
  )
}
