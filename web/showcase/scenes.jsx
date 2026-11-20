import { useLayoutEffect, useRef } from 'react'
import { Button, Card, Code, Icon, Row, Scroll, Stage, Stream, Text, Window } from 'stageshow'
import { MusicMap } from './map'

export const wide = { width: 704, height: 392 }
export const compact = { below: 540, width: 358, height: 320 }
const frame = { ...wide, compact, play: 'once', fidelity: 'realistic', fill: true }
const pointer = { at: { wide: { x: 651, y: 317 }, compact: { x: 326, y: 281 } }, ripple: true, idle: 1000 }

function SceneFrame({ compact, title, readout, children }) {
  const meta = <Text className="film-readout">{readout}</Text>
  if (compact) return <section className="film-window handheld">
    <header className="handheld-bar"><strong>{title}</strong>{meta}</header>
    <div className="film-body">{children}</div>
  </section>
  return <Window title={title} lights="grey" className="film-window" toolbar={meta}>{children}</Window>
}

const studioStart = { open: false, chosen: false }, studioPoster = { open: true, chosen: true }
async function studioScript(a) {
  await a.wait(850)
  a.mark('open-topic'); await a.click({ at: 'music', x: .82, y: .62 })
  a.put({ open: true })
  await a.wait(1800)
  a.mark('inspect-article'); await a.click('jazz'); a.put({ chosen: true })
  await a.move({ at: 'jazz', x: 1.4, y: 1.5 }, { duration: 450 })
  await a.wait(3500)
  a.mark('finished')
}

export function StudioScene({ data }) {
  return <Stage {...frame} className="loom-film studio-film" initial={studioStart} poster={studioPoster} script={studioScript} cursor={pointer}>
    {(s, _rect, layout) => <SceneFrame compact={layout === 'compact'} title="Wikispeedia" readout={data.articles.toLocaleString('en') + ' articles'}>
      <MusicMap data={data} compact={layout === 'compact'} open={s.open} chosen={s.chosen} />
      <Card className="map-receipt" pad="small" gap={4}>
        <Text className="receipt-label">Music topic</Text>
        <Text className="receipt-value">{data.topic.count} articles</Text>
        <span className="receipt-selection" data-show={s.chosen}><i />Jazz selected</span>
      </Card>
    </SceneFrame>}
  </Stage>
}

const sdkStart = { ran: false, result: false, sound: false }, sdkPoster = { ran: true, result: true, sound: true }
async function sdkScript(a) {
  await a.wait(1250)
  a.mark('run-query'); await a.click({ at:'run', x:.77, y:.7 }); a.put({ ran:true })
  await a.wait(420)
  a.mark('read-result'); a.put({ result:true })
  await a.wait(950)
  a.mark('find-sound')
  await a.scroll('neighbors', 'sound', { duration: 1050, offset: 40 })
  await a.click('sound')
  a.put({ sound: true })
  await a.move({ at:'sound', x:.73, y:.72 }, { duration:420 })
  await a.wait(2800)
  a.mark('finished')
}

function QueryResults({ state, data }) {
  const list = useRef(null)
  useLayoutEffect(() => {
    if (!state.sound || !matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const scroller = list.current.querySelector('[data-target=neighbors]')
    const sound = list.current.querySelector('[data-target=sound]')
    scroller.scrollTop += sound.getBoundingClientRect().top - scroller.getBoundingClientRect().top - sound.clientHeight
  }, [state.sound])
  const rows = state.result ? data.neighbors : [
    { id: 'collection', label: 'Collection', section: 'Wikispeedia' },
    { id: 'size', label: 'Articles', section: data.articles.toLocaleString('en') },
    { id: 'term', label: 'Search term', section: 'Music' },
  ]
  return <div className="query-output" ref={list}>
    <div className="output-bar"><Text>{state.result ? 'Outgoing links' : 'Graph input'}</Text>
      <span>{state.result ? data.neighbors.length + ' neighbors' : state.ran ? 'Running query…' : 'graph'}</span></div>
    <Scroll name="neighbors" className="result-rows">
      {rows.map(row => <Row key={row.id} pad={12} title={row.label} meta={row.section}
        data-target={row.id === data.soundId ? 'sound' : undefined} selected={row.id === data.soundId && state.sound} />)}
    </Scroll>
  </div>
}

export function SdkScene({ data }) {
  return <Stage {...frame} className="loom-film sdk-film" initial={sdkStart} poster={sdkPoster} script={sdkScript} cursor={pointer} theme="dark">
    {(s, _rect, layout) => {
      const short = layout === 'compact'
      const lines = short ? ['const [music] = index.search("Music")', 'index.neighbors(music.id, "outgoing")'] :
        ['const index = createGraphIndex(graph)', 'const [music] = index.search("Music")', 'index.neighbors(music.id, "outgoing")']
      return <SceneFrame compact={short} title="explore.ts" readout="loom-core/explore">
        <div className="sdk-code"><Code lines={lines} numbers={!short} />
          <Button size="small" data-target="run" icon={<Icon name="play" size={14} />}>Run query</Button></div>
        <QueryResults state={s} data={data} />
      </SceneFrame>
    }}
  </Stage>
}

const mcpStart = { asked: false, words: 0, cited: false }
export function McpScene({ data }) {
  const passage = data.evidence.excerpt, words = passage.split(' ').length
  async function query(a) {
    await a.wait(1250)
    a.mark('ask'); await a.click({ at:'ask', x:.78, y:.64 }); a.put({ asked:true })
    await a.wait(700)
    a.mark('passage')
    for (let i=1; i<=words; i++) { a.put({ words:i }); await a.wait(76) }
    await a.wait(500)
    a.mark('citation'); a.put({ cited:true })
    await a.move({ at:'source', x:.90, y:.75 }, { duration:680 })
    await a.wait(3000)
    a.mark('finished')
  }
  return <Stage {...frame} className="loom-film mcp-film" initial={mcpStart} poster={{ asked:true, words, cited:true }} script={query} cursor={pointer}>
    {(s, _rect, layout) => <SceneFrame compact={layout === 'compact'} title="Graph MCP" readout="Wikispeedia">
      <div className="mcp-question"><Text>How does Music link to Sound?</Text>
        <Button data-target="ask" size="small" icon={<Icon name="arrow" size={14} />}>Ask</Button></div>
      <div className="mcp-sheets"><div className="answer-sheet" data-show={s.asked}>
        <span className="tool-name"><img src="/icon.png" alt="" />get_connection</span>
        <div className="answer-pair">Music <span>→</span> Sound</div>
        <div className="answer-passage" data-show={s.asked}><Stream text={passage} count={s.words} /></div>
        <div className="evidence-source" data-target="source" data-show={s.cited}><Icon name="globe" size={14} />2007 Schools Wikipedia · {data.evidence.section}</div>
      </div><div className="request-sheet" data-show={!s.asked}>
        <span className="tool-name"><img src="/icon.png" alt="" />get_connection</span>
        <div className="request-field"><span>Graph</span><strong>Wikispeedia</strong></div>
        <div className="request-field"><span>From article</span><strong>Music</strong></div>
        <div className="request-field"><span>To article</span><strong>Sound</strong></div>
      </div></div>
    </SceneFrame>}
  </Stage>
}
