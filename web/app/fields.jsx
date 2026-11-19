import { useEffect, useRef } from 'react'

export function Select({ id, label, options, value, onChange, disabled = false }) {
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
  </div>
}

export function Range({ id, label, value, onChange, min, max, step = 1, outputId = id + '-value', format = String }) {
  return <>
    <label htmlFor={id}>{label}<output id={outputId} htmlFor={id}>{format(value)}</output></label>
    <input id={id} type="range" min={min} max={max} step={step} value={value}
      onChange={(event) => onChange(Number(event.target.value))} />
  </>
}

export function Check({ id, label, checked, onChange }) {
  return <label className="check"><input id={id} type="checkbox" checked={checked}
    onChange={(event) => onChange(event.target.checked)} />{label}</label>
}

export function Color({ id, label, value, onChange }) {
  return <div className="field"><label htmlFor={id}>{label}</label>
    <input id={id} type="color" value={value} onChange={(event) => onChange(event.target.value)} />
  </div>
}

// A new interaction can reveal a section; toggling it by hand lasts until
// the next change of context. Native details owns keyboard and focus behavior.
export function InspectorSection({ title, value, reveal, initialOpen = false, className = '', children }) {
  const ref = useRef(null)
  const previous = useRef(reveal)
  useEffect(() => {
    if (previous.current !== reveal && reveal != null && reveal !== false) ref.current.open = true
    previous.current = reveal
  }, [reveal])
  return <details ref={ref} className={'inspector-section ' + className} open={initialOpen || undefined}>
    <InspectorSummary title={title} value={value}/>
    <div className="inspector-body">{children}</div>
  </details>
}

export function InspectorSummary({ title, value }) {
  return <summary><span>{title}</span>{value !== undefined && <small>{value}</small>}<i aria-hidden="true" /></summary>
}
