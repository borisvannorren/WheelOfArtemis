// 360° × (2 − φ): stepping round the colour wheel by this angle spreads any run of ids evenly.
const GOLDEN_ANGLE = 137.50776405003785

/**
 * A fixed colour per team member, derived from their id, so it never changes and needs no storage.
 * Consecutive ids land far apart on the colour wheel (golden-angle hue steps). The colour is picked in OKLCH,
 * which keeps the perceived lightness equal across hues, so the dark labels on the wheel stay readable; even and
 * odd ids differ slightly in lightness, which separates the occasional pair of ids whose hues end up close together.
 * Returned as hex, because the confetti library only understands hex colours.
 */
export function memberColor(id: number) {
  const hue = (id * GOLDEN_ANGLE) % 360
  const lightness = id % 2 === 0 ? 0.74 : 0.82
  return oklchToHex(lightness, 0.1, hue)
}

/** OKLCH to sRGB hex, using Björn Ottosson's OKLab matrices. Out-of-gamut channels are clipped. */
function oklchToHex(lightness: number, chroma: number, hueDegrees: number) {
  const hue = (hueDegrees * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]

  return `#${linear.map((channel) => toHexChannel(gammaEncode(channel))).join('')}`
}

function gammaEncode(channel: number) {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
}

function toHexChannel(channel: number) {
  return Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0')
}
