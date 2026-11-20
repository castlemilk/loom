import { range } from './constraints.js'

export interface AtlasSpringSettings {
  /** Stiffness relative to the original atlas spring. Lower values produce a longer trail. */
  strength: number
  /** Damping ratio. At 1, a resting article catches up without overshooting a fixed target. */
  damping: number
}
export const atlasSpringControls = {
  strength: { min: 0.25, max: 4, step: 0.05, default: 1 },
  damping: { min: 0.2, max: 1, step: 0.05, default: 1 },
} as const
export function resolveSpring(
  patch?: Partial<AtlasSpringSettings>,
  previous?: AtlasSpringSettings,
): AtlasSpringSettings {
  const { strength, damping } = atlasSpringControls
  return {
    strength: range(
      patch?.strength ?? previous?.strength ?? strength.default,
      strength.min,
      strength.max,
      'atlas spring strength',
    ),
    damping: range(
      patch?.damping ?? previous?.damping ?? damping.default,
      damping.min,
      damping.max,
      'atlas spring damping',
    ),
  }
}

export interface ArticleSpring {
  x: number
  y: number
  z: number
  target: { x: number; y: number; z: number }
  vx: number
  vy: number
  vz: number
  frequency: number
}

// Exact damped oscillator over elapsed seconds, including the critically damped limit.
// All three axes share the same transition. Changing a control retains position and velocity.
export function advanceSpring(s: ArticleSpring, settings: AtlasSpringSettings, dt: number) {
  const w = s.frequency * Math.sqrt(settings.strength),
    drag = settings.damping * w
  const wd = w * Math.sqrt(1 - settings.damping ** 2),
    decay = Math.exp(-drag * dt)
  const sine = decay * (wd ? Math.sin(wd * dt) / wd : dt),
    cosine = decay * Math.cos(wd * dt)
  const fromPosition = cosine + drag * sine,
    fromVelocity = cosine - drag * sine
  const acceleration = -w * w * sine
  const dx = s.x - s.target.x,
    dy = s.y - s.target.y,
    dz = s.z - s.target.z
  s.x = s.target.x + fromPosition * dx + sine * s.vx
  s.y = s.target.y + fromPosition * dy + sine * s.vy
  s.z = s.target.z + fromPosition * dz + sine * s.vz
  s.vx = acceleration * dx + fromVelocity * s.vx
  s.vy = acceleration * dy + fromVelocity * s.vy
  s.vz = acceleration * dz + fromVelocity * s.vz
  return (
    Math.max(Math.abs(s.x - s.target.x), Math.abs(s.y - s.target.y), Math.abs(s.z - s.target.z)) < 0.025 &&
    Math.max(Math.abs(s.vx), Math.abs(s.vy), Math.abs(s.vz)) < 0.5
  )
}
