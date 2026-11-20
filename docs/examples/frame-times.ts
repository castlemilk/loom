import type { LoomGraph } from 'loom-core'
import { observePerformance } from 'loom-core/performance'

const milliseconds = (value: number | null) => value === null ? '—' : value.toFixed(1) + ' ms'

export function showFrameTimes(graph: LoomGraph, display: (values: Record<string, string>) => void) {
  return observePerformance(graph, sample => {
    display({
      State: sample.idle ? 'Idle' : 'Active',
      'Graph FPS': sample.fps.toFixed(0),
      'Active p95': milliseconds(sample.p95FrameMs),
      'Main thread': milliseconds(sample.mainThreadMs),
      'GPU draw': sample.gpuStatus === 'measured' ? milliseconds(sample.gpuMs) : sample.gpuStatus,
      Frames: String(sample.frames),
    })
  })
}
