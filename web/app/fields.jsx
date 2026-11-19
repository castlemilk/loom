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
