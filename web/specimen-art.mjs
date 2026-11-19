import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { imagePoolSize, randomSource } from './app/workload.mjs'

// Render the load-test gallery during the build. Opening the studio only fetches
// the WebPs referenced by the active fixture, through the normal artwork atlas.
export async function writeSpecimens(directory) {
  await mkdir(directory, { recursive: true })
  const size = 128
  for (let id = 0; id < imagePoolSize; id++) {
    const random = randomSource(1009 * id + 173)
    const phase = random() * 6, tilt = random() * 1.4 - 0.7
    const cells = Array.from({ length: 8 }, () => [random() * 2 - 1, random() * 2 - 1, 0.08 + random() * 0.3])
    const tones = [
      [[17, 40, 52], [68, 160, 148], [236, 213, 153]],
      [[27, 22, 48], [132, 94, 156], [249, 189, 130]],
      [[20, 35, 43], [73, 124, 146], [206, 225, 212]],
      [[38, 35, 49], [180, 93, 76], [252, 202, 137]],
    ][id % 4]
    const pixels = Buffer.alloc(size * size * 3)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = 2 * x / size - 1, v = 2 * y / size - 1, grain = random()
      let value
      switch (id % 4) {
        case 0: { // Topographic contours.
          const height = Math.sin(u * 3 + phase) * 0.27 + Math.cos(v * 3.4 + u * tilt) * 0.21 + 0.5
          value = height * 0.72 + 0.29 * Math.exp(-5 * Math.abs(Math.sin(height * 43)))
          break
        }
        case 1: { // Celestial discs and a thin inclined ring.
          const r = Math.hypot(u * 1.04, v), ring = Math.hypot(u, (v - u * tilt) * 3)
          value = r < 0.58 ? 0.42 + Math.sqrt(1 - (r / 0.58) ** 2) * 0.32 - u * 0.23 + 0.09 * Math.sin(v * 28 + phase + Math.sin(u * 4)) :
            0.025 + (grain > 0.996 ? 0.72 : 0)
          if (ring > 0.72 && ring < 0.88 && (v > u * tilt || r > 0.58)) value += 0.44 + 0.12 * Math.sin(ring * 160)
          break
        }
        case 2: { // Interference field.
          const wave = Math.sin(15 * Math.hypot(u - 0.45, v + tilt)) + Math.cos(18 * Math.hypot(u + 0.51, v) + phase)
          value = 0.12 + 0.72 * ((wave + 2) / 4) ** 2
          break
        }
        default: { // A microscopy field of membranes and nuclei.
          value = 0.12
          for (const [cx, cy, r] of cells) {
            const d = Math.hypot(u - cx, v - cy) / r
            if (d < 1.15) value = Math.max(value, 0.28 + 0.51 * Math.exp(-12 * Math.abs(d - 0.9)) + 0.32 * Math.exp(-8 * d * d))
          }
        }
      }
      value = Math.max(0, Math.min(1, value + grain * 0.055))
      const half = value < 0.5 ? 0 : 1, mix = value * 2 - half
      for (let channel = 0; channel < 3; channel++)
        pixels[(y * size + x) * 3 + channel] = Math.round(tones[half][channel] * (1 - mix) + tones[half + 1][channel] * mix)
    }
    await sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
      .webp({ quality: 79 }).toFile(fileURLToPath(new URL(id + '.webp', directory)))
  }
}
