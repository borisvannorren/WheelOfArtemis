// 360° × (2 − φ): stepping round the colour wheel by this angle spreads any run of ids evenly.
const GOLDEN_ANGLE = 137.50776405003785

/**
 * A fixed colour per team member, derived from their id, so it never changes and needs no storage.
 * Consecutive ids land far apart on the colour wheel (golden-angle hue steps). OKLCH keeps the perceived
 * lightness equal across hues, so the dark labels on the wheel stay readable; even and odd ids differ
 * slightly in lightness, which separates the occasional pair of ids whose hues end up close together.
 */
export function memberColor(id: number) {
  const hue = (id * GOLDEN_ANGLE) % 360
  const lightness = id % 2 === 0 ? 0.74 : 0.82
  return `oklch(${lightness} 0.1 ${hue.toFixed(1)})`
}
