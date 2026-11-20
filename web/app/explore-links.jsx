import { useMemo, useState } from 'react'
import { InspectorSection } from './fields'

const pageSize = 5

function FollowList({ rows, follow, label }) {
  const [count, setCount] = useState(pageSize)
  return <>
    <ul className="follow-list" aria-label={label}>{rows.slice(0, count).map(({ node, detail }) =>
      <li key={node.id}><button type="button" data-follow={node.id} onClick={() => follow(node.id)}>
        <span>{node.label || node.id}</span><small>{detail}</small><b aria-hidden="true">↗</b>
      </button></li>)}</ul>
    {count < rows.length && <button type="button" className="more-links" onClick={() => setCount(count + pageSize)}>
      Show more ({rows.length - count})</button>}
  </>
}

export function NodeLinks({ node, index, follow, article }) {
  const [direction, setDirection] = useState('outgoing')
  const lists = useMemo(() => ({
    incoming: index.neighbors(node.id, 'incoming'), outgoing: index.neighbors(node.id, 'outgoing'),
  }), [node.id, index])
  const rows = lists[direction].map(({ node, links }) => ({ node, detail: links.length > 1 ? links.length + ' links' : node.section || node.kind }))
  return <InspectorSection title={article ? 'Article links' : 'Follow links'} value={'→ ' + lists.outgoing.length + '  ← ' + lists.incoming.length}
    initialOpen={article} className="follow-inspector">
    <div className="direction-switch" role="group" aria-label="Link direction">
      {['outgoing', 'incoming'].map((d) => <button type="button" key={d} aria-pressed={direction === d} onClick={() => setDirection(d)}>
        {d === 'outgoing' ? 'Outgoing' : 'Incoming'} <small>{lists[d].length}</small></button>)}
    </div>
    {rows.length ? <FollowList key={direction} rows={rows} follow={follow} label={direction === 'incoming' ? 'Incoming neighbors' : 'Outgoing neighbors'}/>
      : <p role="status">No {direction} links.</p>}
  </InspectorSection>
}

export function GroupLinks({ members, index, follow }) {
  const rows = useMemo(() => index.boundary(members.map((n) => n.id)).map(({node, incoming, outgoing}) => {
    const count = incoming + outgoing
    return { node, detail: count + (count === 1 ? ' link' : ' links') }
  }), [index, members])
  return rows.length > 0 && <InspectorSection title="Beyond this group" value={rows.length} className="follow-inspector">
    <FollowList rows={rows} follow={follow} label="Neighbors outside this group"/>
  </InspectorSection>
}

export function wikipediaSource(node) {
  return Number.isSafeInteger(node?.wikipediaRevision) && node.wikipediaRevision > 0
    ? 'https://en.wikipedia.org/w/index.php?oldid=' + node.wikipediaRevision : null
}
