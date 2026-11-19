// The slider keeps percent-level precision. The buttons use larger steps at high magnification.
const sizeSteps = [30, 50, 75, 100, 125, 150, 200, 300, 400, 600, 800, 1200, 1600]
export const minNodeSize = sizeSteps[0]
export const maxNodeSize = sizeSteps.at(-1)
export const nodeCounts = [1000, 5000, 10000, 25000]

export function stepNodeSize(percent, direction) {
  if (direction > 0) return sizeSteps.find((step) => step > percent) ?? maxNodeSize
  return sizeSteps.findLast((step) => step < percent) ?? minNodeSize
}

export function sizeLabel(percent) {
  return percent / 100 + '×'
}
