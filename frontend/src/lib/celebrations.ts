// Celebrations with canvas-confetti. It draws on its own overlay that ignores clicks, and stays off for people who
// prefer reduced motion. The library is loaded on first use, so it is not part of the initial page load.

import { propelStarfield } from './starfield'

const THEME_COLORS = ['#e4572e', '#f2845f', '#ffffff']
const STAR_COLORS = ['#ffe400', '#ffbd00', '#e89400', '#ffca6c', '#fdffb8']
const STAR_BURST_DELAYS_MS = [0, 100, 200]

/** Position on the page as fractions of the viewport, as canvas-confetti expects. */
export type ViewportPoint = { x: number; y: number }

/** A small upward burst for a new crew, in the crew's colours plus the theme's. */
export async function fireCrewCannon(colors: string[], origin: ViewportPoint) {
  const { default: confetti } = await import('canvas-confetti')
  await confetti({
    particleCount: 40,
    angle: 90,
    spread: 55,
    startVelocity: 32,
    ticks: 120,
    scalar: 0.8,
    colors: [...colors, ...THEME_COLORS],
    origin,
    disableForReducedMotion: true,
  })
}

/**
 * The final crew's celebration: three quick bursts of golden stars from the middle of the page, while the starfield
 * lifts off and keeps rising. The bursts follow canvas-confetti's "Stars" example.
 */
export async function celebrateFinalCrew() {
  propelStarfield()

  const { default: confetti } = await import('canvas-confetti')
  const burst = {
    spread: 360,
    ticks: 50,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    colors: STAR_COLORS,
    disableForReducedMotion: true,
  }

  const shoot = () => {
    void confetti({ ...burst, particleCount: 40, scalar: 1.2, shapes: ['star'] })
    void confetti({ ...burst, particleCount: 10, scalar: 0.75, shapes: ['circle'] })
  }

  for (const delayMs of STAR_BURST_DELAYS_MS) {
    setTimeout(shoot, delayMs)
  }
}
