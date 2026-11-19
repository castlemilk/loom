// A single outstanding callback. Each reason holds its own suspension vote.
export class Scheduler {
  #handle: number | null = null
  #blocked = new Set<string>()
  #dead = false
  constructor(
    private frame: (time: number) => boolean,
    private request = (cb: FrameRequestCallback) => requestAnimationFrame(cb),
    private cancel = (id: number) => cancelAnimationFrame(id),
  ) {}
  get active() {
    return !this.#dead && this.#blocked.size === 0
  }
  get pending() {
    return this.#handle !== null
  }
  wake = () => {
    if (!this.active || this.pending) return
    this.#handle = this.request((time) => {
      this.#handle = null
      if (this.active && this.frame(time)) this.wake()
    })
  }
  suspend(reason: string, value: boolean) {
    if (value) {
      this.#blocked.add(reason)
      this.#stop()
    } else if (this.#blocked.delete(reason)) this.wake()
  }
  #stop() {
    if (this.#handle !== null) this.cancel(this.#handle)
    this.#handle = null
  }
  destroy() {
    this.#dead = true
    this.#stop()
  }
}

export class Resolution {
  scale: number
  #slow = 0
  #fast = 0
  #changed = -Infinity
  constructor(private maximum: number) {
    this.scale = maximum
  }
  sample(work: number, elapsed: number, now: number) {
    if (now - this.#changed < 750) return false
    const slow = work > 15 || (elapsed > 22 && elapsed < 100)
    this.#slow = slow ? this.#slow + 1 : 0
    this.#fast = !slow && work < 6 ? this.#fast + 1 : 0
    let next = this.scale
    if (this.#slow >= 8) next = Math.max(Math.min(0.7, this.maximum), this.scale * 0.8)
    if (this.#fast >= 90) next = Math.min(this.maximum, this.scale / 0.8)
    if (next === this.scale) return false
    this.scale = next
    this.#changed = now
    this.#slow = this.#fast = 0
    return true
  }
}
