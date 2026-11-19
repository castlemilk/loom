import { InspectorSection, Range, Select } from './fields'
import { wireEffectsSchema } from '../../dist/wires.js'

const directions = [['none', 'Off'], ['arrow', 'Arrows'], ['flow', 'Flow']]
const scopes = [['selected', 'Selected node'], ['all', 'All connections']]

export function WireControls({ effects, setEffects, route }) {
  const set = (key, value) => setEffects((old) => ({ ...old, [key]: value }))
  const { separation, speed } = wireEffectsSchema.properties
  return <InspectorSection title="Connection drawing" value={directions.find(([key]) => key === effects.direction)[1] + ' · ' + effects.separation + ' px'}
    reveal={route + '/' + effects.direction}>
    <fieldset className="wire-direction">
      <legend>Direction</legend>
      <div>{directions.map(([id, label]) => <label key={id}>
        <input type="radio" name="wire-direction" value={id} checked={effects.direction === id} onChange={() => set('direction', id)}/>
        <svg aria-hidden="true" width="28" height="14" viewBox="0 0 28 14" fill="none">
          <path d="M2 10C9 10 11 4 24 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          {id !== 'none' && <path d="m19 1.2 6 2.7-5.6 3" fill="currentColor"/>}
          {id === 'flow' && <circle cx="11.8" cy="7" r="2.4" fill="currentColor"/>}
        </svg><span>{label}</span>
      </label>)}</div>
    </fieldset>
    {effects.direction !== 'none' && <Select id="wire-scope" label="Show on" options={scopes} value={effects.scope} onChange={(v) => set('scope', v)}/>}
    <Range id="wire-separation" label="Parallel spacing" min={separation.minimum} max={separation.maximum} value={effects.separation} format={(v) => v + ' px'}
      onChange={(v) => set('separation', v)}/>
    {effects.direction === 'flow' && <>
      <Range id="wire-speed" label="Flow speed" min={speed.minimum} max={speed.maximum} value={effects.speed} format={(v) => v + ' px/s'} onChange={(v) => set('speed', v)}/>
      <p className="wire-motion-note">Reduced motion is on. Direction is shown with static arrows.</p>
    </>}
  </InspectorSection>
}
