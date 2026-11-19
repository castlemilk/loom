import type { Theme } from './types.js'

export const parchment: Theme = {
  kind: {
    blog: '#456c93',
    lab: '#377363',
    study: '#ad5c43',
    tag: '#766d60',
    concept: '#a57823',
    category: '#696891',
  },
  ink: '#292923',
  dim: '#857c6e',
  accent: '#a8412a',
  bg: '#f3eddd',
  bezel: '#ddd4bd',
  font: 'system-ui, sans-serif',
  fontSize: 12,
  radii: { hub: 6, content: 4 },
  plateAlpha: 0.9,
}
export const ink: Theme = {
  ...parchment,
  kind: {
    blog: '#7ca8e3',
    lab: '#73bfaa',
    study: '#dc926e',
    tag: '#a29c91',
    concept: '#deb864',
    category: '#a998c8',
  },
  ink: '#e6e5db',
  dim: '#7d8996',
  accent: '#fee1a1',
  bg: '#15191d',
  bezel: '#242b30',
}
export const blueprint: Theme = {
  ...ink,
  kind: {
    blog: '#a7c7f7',
    lab: '#7ad5d1',
    study: '#eebd83',
    tag: '#9fafc7',
    concept: '#f4d193',
    category: '#bebbea',
  },
  ink: '#e1edf5',
  dim: '#8ba8c1',
  accent: '#ffffff',
  bg: '#152f48',
  bezel: '#25465e',
}

export function rgb(color: string): [number, number, number] {
  let hex = color.slice(1)
  if (hex.length === 3) hex = hex[0].repeat(2) + hex[1].repeat(2) + hex[2].repeat(2)
  if (!color.startsWith('#') || !/^[0-9a-f]{6}$/i.test(hex))
    throw new TypeError('Expected an RGB hex colour, received ' + color)
  const value = parseInt(hex, 16)
  return [value >> 16, (value >> 8) & 255, value & 255]
}

export const knowledgeConsole: Theme = {
  ...ink,
  bg: '#171918',
  bezel: '#232624',
  ink: '#f2f2ee',
  dim: '#8f8f87',
  accent: '#e6c34a',
  kind: {
    blog: '#6ea8ff',
    lab: '#4cd97a',
    study: '#ff9d6b',
    tag: '#9a9a92',
    concept: '#e6c34a',
    category: '#7d8a9a',
  },
  font: '"IBM Plex Mono", ui-monospace, monospace',
  fontSize: 12,
  nodes: {
    scale: 1.15,
    ringWidth: 1,
    fill: 0.85,
    byKind: {
      blog: { shape: 'square' },
      lab: { shape: 'square' },
      study: { shape: 'square' },
      tag: { shape: 'ring' },
      category: { shape: 'ring' },
      concept: { shape: 'ring' },
    },
  },
  wires: {
    routing: 'patch',
    color: '#f2f2ee',
    width: 0.8,
    opacity: 0.16,
    hotWidth: 2,
    byKind: { concept: { color: '#e6c34a', opacity: 0.42 }, category: { opacity: 0.09 } },
  },
  labels: { alternateSide: true },
  grid: { spacing: 32, color: '#99a69c', opacity: 0.19 },
}
