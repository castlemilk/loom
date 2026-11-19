import { Layout } from './layout.js'
import type { WorkerCommand, WorkerFrame } from './messages.js'

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerCommand>) => void) | null
  postMessage(value: WorkerFrame, transfer: Transferable[]): void
}
let layout: Layout,
  shared: Float32Array[] = [],
  suspended = false
let job: Extract<WorkerCommand, { type: 'step' }> | null = null
let timer: ReturnType<typeof setTimeout> | undefined
function run() {
  timer = undefined
  if (!job || suspended) return
  const ticks = layout.advance(4, job.paced ? 1 : 4)
  if (!ticks && layout.alpha) {
    timer = setTimeout(run, 0)
    return
  }
  const output = job.buffer ? new Float32Array(job.buffer) : shared[job.slot]
  output.set(layout.data.positions)
  scope.postMessage(
    { epoch: job.epoch, slot: job.slot, buffer: job.buffer, ticks, active: layout.alpha > 0 },
    job.buffer ? [job.buffer] : [],
  )
  job = null
}
scope.onmessage = ({ data: m }) => {
  switch (m.type) {
    case 'init':
      layout = new Layout(m.data, m.mode, m.forces, m.targets)
      shared = m.shared.map((b) => new Float32Array(b))
      break
    case 'configure':
      layout.configure(m.mode, m.update)
      break
    case 'pin':
      layout.pin(m.i, m.x, m.y, m.fixed, m.z)
      break
    case 'suspend':
      suspended = m.value
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      if (!suspended) run()
      break
    case 'step':
      job = m
      run()
      break
  }
}
