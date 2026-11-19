import { useMemo } from 'react'
import { mapNodeRadius, mapWireWidth } from '../../dist/metrics.js'
import { Range, Select } from './fields'

export const initialEncoding = { node: 'theme', wire: 'theme', curve: 'sqrt', radii: [4, 18], widths: [0.75, 5] }
const nodes = [['theme','Theme default'], ['degree','Connections'], ['contentSize','Content bytes'], ['complexity','Complexity']]
const wires = [['theme','Styled width'], ['connections','Endpoint connections'], ['multiplicity','Links per pair'], ['weight','Link weight']]
const curves = [['linear','Linear'], ['sqrt','Square root'], ['log','Logarithmic']]
const metric = (key) => key.startsWith('metric:') ? (item) => item.metrics?.[key.slice(7)] : key
function choices(items, builtIn) {
  const keys = new Set()
  for (const item of items) if (item.metrics) for (const k of Object.keys(item.metrics)) keys.add(k)
  return [...builtIn, ...[...keys].sort().map((key) => ['metric:' + key, key])]
}

export function useEncodings(data, encoding) {
  const nodeOptions = useMemo(() => choices(data.nodes, nodes), [data])
  const wireOptions = useMemo(() => choices(data.links, wires), [data])
  const node = nodeOptions.some(([key]) => key === encoding.node) ? encoding.node : 'theme'
  const wire = wireOptions.some(([key]) => key === encoding.wire) ? encoding.wire : 'theme'
  const radius = useMemo(() => node === 'theme' ? undefined : mapNodeRadius(data, metric(node), { curve: encoding.curve, range: encoding.radii }),
    [data, node, encoding.curve, encoding.radii])
  const width = useMemo(() => wire === 'theme' ? undefined : mapWireWidth(data, metric(wire), { curve: encoding.curve, range: encoding.widths }),
    [data, wire, encoding.curve, encoding.widths])
  const missingNodes = useMemo(() => !!radius && !data.nodes.some((n) => radius(n)), [data, radius])
  const missingWeights = useMemo(() => !!width && !data.links.some((e, i) => width(e, i)), [data, width])
  return { ...encoding, radius, width, nodeOptions, wireOptions, node, wire, missingNodes, missingWeights }
}
export function EncodingControls({ mapped, onChange }) {
  return <>
    <Select id="size-by" label="Size nodes by" value={mapped.node} options={mapped.nodeOptions} onChange={(node) => onChange({ node })} />
    <Select id="width-by" label="Weight wires by" value={mapped.wire} options={mapped.wireOptions} onChange={(wire) => onChange({ wire })} />
    {(mapped.radius || mapped.width) && <Select id="metric-curve" label="Metric scale" value={mapped.curve} options={curves} onChange={(curve) => onChange({ curve })} />}
    {(mapped.radius || mapped.width) && <details><summary>Metric ranges</summary>
      {mapped.radius && <>
        <Range id="min-radius" label="Minimum radius" min={0} max={mapped.radii[1]} value={mapped.radii[0]} onChange={(v) => onChange({ radii: [v, mapped.radii[1]] })} />
        <Range id="max-radius" label="Maximum radius" min={mapped.radii[0]} max={64} value={mapped.radii[1]} onChange={(v) => onChange({ radii: [mapped.radii[0], v] })} />
      </>}
      {mapped.width && <>
        <Range id="min-width" label="Minimum stroke" min={0} max={mapped.widths[1]} step={0.25} value={mapped.widths[0]} format={(v) => v + ' px'} onChange={(v) => onChange({ widths: [v, mapped.widths[1]] })} />
        <Range id="max-width" label="Maximum stroke" min={mapped.widths[0]} max={32} step={0.25} value={mapped.widths[1]} format={(v) => v + ' px'} onChange={(v) => onChange({ widths: [mapped.widths[0], v] })} />
      </>}
    </details>}
    {(mapped.missingNodes || mapped.missingWeights) && <p className="encoding-note" role="status">
      {mapped.missingNodes && 'Nodes have no values for this metric. '}{mapped.missingWeights && 'Links have no values for this metric. '}
      The theme supplies their sizes.</p>}
  </>
}
