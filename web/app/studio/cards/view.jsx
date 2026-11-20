'use client'

import { useState } from 'react'
import data from '../../../public/examples/around-canva.json'
import { AtlasShell, ModeSwitch } from '../../atlas-shell'
import { CardView } from '../../card-view'
import { docsURL, homeURL, studioURL } from '../../../site'

const root = 'startup:canva'
export default function AroundCanva() {
  const [id, select] = useState(root),
    [appearance, setAppearance] = useState('cards'),
    [labels, setLabels] = useState(true),
    [ports, setPorts] = useState(true)
  const [arrows, setArrows] = useState(false)
  const node = data.nodes.find((n) => n.id === id),
    edges = data.links.filter((e) => e.source === id || e.target === id)
  return (
    <AtlasShell name="cards/">
      <main className="atlas-workarea card-example">
        <section className="atlas-board">
          <div className="atlas-board-title">
            <div>
              <h1>Around Canva</h1>
              <p>7 entities · 6 relationships</p>
            </div>
          </div>
          <CardView
            data={data}
            root={root}
            selected={id}
            onSelect={(n) => select(n.id)}
            appearance={appearance}
            labels={labels}
            ports={ports}
            arrows={arrows}
          />
        </section>
        <aside className="atlas-side" aria-label="Card graph controls">
          <ModeSwitch
            label="Node appearance"
            value={appearance}
            choices={[
              ['cards', 'Cards'],
              ['dots', 'Dots'],
            ]}
            onChange={setAppearance}
          />
          <label className="atlas-check">
            <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
            Relationship labels
          </label>
          <label className="atlas-check">
            <input type="checkbox" checked={arrows} onChange={(e) => setArrows(e.target.checked)} />
            Direction arrows
          </label>
          <label className="atlas-check">
            <input
              type="checkbox"
              checked={ports}
              disabled={appearance === 'dots'}
              onChange={(e) => setPorts(e.target.checked)}
            />
            Card ports
          </label>
          <section className="atlas-detail" aria-label="Selected entity">
            <span className="atlas-kicker">{node.kind}</span>
            <h2>{node.label}</h2>
            <ul className="atlas-references">
              {edges.map((e) => {
                const other = data.nodes.find((n) => n.id === (id === e.source ? e.target : e.source))
                return (
                  <li key={other.id}>
                    <button type="button" onClick={() => select(other.id)}>
                      {other.label}
                    </button>
                    <small>{e.label}</small>
                    <a href={e.evidence} target="_blank" rel="noreferrer">
                      Evidence ↗
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
          <p className="atlas-help">
            Select a card to inspect its relationships. Drag a card to move it, or use its arrow keys.
          </p>
          <a className="atlas-text-link" href={homeURL + 'examples/around-canva.json'}>
            Graph data ↗
          </a>
          <a className="atlas-text-link" href={docsURL + 'navigation/#open-relationship-cards'}>Build relationship cards with the SDK →</a>
          <a className="atlas-text-link" href={studioURL + 'wikispeedia/'}>
            Open the Wikipedia atlas →
          </a>
        </aside>
      </main>
    </AtlasShell>
  )
}
