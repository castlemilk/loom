import type { Mode } from '../types.js'
import type { LayoutData } from './layout.js'

import type { Forces, LayoutUpdate } from '../constraints.js'

export type WorkerCommand =
  | {
      type: 'init'
      data: LayoutData
      mode: Mode
      forces: Forces
      targets?: Float32Array
      shared: SharedArrayBuffer[]
    }
  | { type: 'configure'; mode: Mode; update?: LayoutUpdate }
  | { type: 'pin'; i: number; x: number; y: number; fixed: number; z?: number }
  | { type: 'suspend'; value: boolean }
  | { type: 'step'; epoch: number; slot: number; paced: boolean; buffer?: ArrayBuffer }
export interface WorkerFrame {
  epoch: number
  slot: number
  buffer?: ArrayBuffer
  ticks: number
  active: boolean
}
