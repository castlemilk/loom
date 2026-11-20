import { Range } from './fields'
import { palettes, papers } from './appearance'

function Choices({ label, name, options, current, change }) {
  return <fieldset className={'drawing-choices ' + name}>
    <legend>{label}</legend>
    <div>{options.map(([key, text, sample]) => <label key={key}>
      <input type="radio" name={name} checked={current === key} onChange={() => change(key)} />
      {sample}<span>{text}</span>
    </label>)}</div>
  </fieldset>
}

const fills = [['solid', 'Solid'], ['hachure', 'Hachure'], ['cross-hatch', 'Cross-hatch']]
  .map(([id, label]) => [id, label, <i key={id} aria-hidden="true" data-fill={id}/>])
const lines = [
  [0, 'Precise', 'M2 10h32'],
  [1, 'Loose', 'M2 11Q11 7 19 9.5T34 9'],
  [2, 'Sketchy', 'M2 11Q8 7 16 9T26 8.5L34 8M4 12q12-5 25-2'],
].map(([id, label, path]) => [id, label, <svg key={id} viewBox="0 0 36 18" aria-hidden="true"><path d={path}/></svg>])

export function DrawingControls({ style, paint }) {
  const drawing = style.drawing
  const base = palettes[style.name]
  const choices = [['theme', 'Theme', base.bg], ...Object.entries(papers).filter(([,p]) => p.bg !== base.bg)
    .map(([key, p]) => [key, key[0].toUpperCase() + key.slice(1), p.bg])]
    .map(([key, label, bg]) => [key, label, <i key={key} aria-hidden="true" className="paper-swatch" style={{ backgroundColor: bg }}/>])
  return <div className="drawing-kit">
    <Choices label="Paper" name="drawing-paper" current={style.paper} options={choices} change={(key) => paint('paper', key)}/>
    <Choices label="Marker fill style" name="drawing-fill" current={drawing.fill} options={fills}
      change={(fill) => paint('drawing', { ...drawing, fill })}/>
    {drawing.fill !== 'solid' && <Range id="hatch-spacing" label="Hatch spacing" min={2} max={16} value={drawing.hatchSpacing} format={(n) => n + ' px'}
      onChange={(hatchSpacing) => paint('drawing', { ...drawing, hatchSpacing })}/>}
    <Choices label="Linework" name="drawing-line" current={drawing.roughness} options={lines}
      change={(roughness) => paint('drawing', { ...drawing, roughness })}/>
    <Range id="outline-width" label="Marker outline" min={0} max={6} step={0.1} value={style.ringWidth} format={(n) => n + ' px'}
      onChange={(value) => paint('ringWidth', value)}/>
  </div>
}
