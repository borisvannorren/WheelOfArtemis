// The ascent of the starfield: after the final crew launches, the stars scroll down so the page seems to rise, first
// with a boost right after the launch and then at a slow cruise for as long as the page stays open. Undoing a launch
// or scrubbing a mission switches the engines off and the stars come to rest.
//
// The speed eases towards a target (boost, cruise or zero) instead of jumping, and the loop moves the star layers
// through the --stars-near and --stars-far variables used by the body background in globals.css.

/** Pixels per second of the near star layer. */
const BOOST_SPEED = 260
const CRUISE_SPEED = 45
const BOOST_MS = 3000
/** The far layer moves slower than the near one, which gives the starfield depth. */
const FAR_LAYER_RATIO = 370 / 480

type Thrust = { targetSpeed: number; responseMs: number }

let offset = 0
let speed = 0
let thrust: Thrust = { targetSpeed: 0, responseMs: 400 }
let frame: number | undefined
let lastTime: number | undefined
let boostTimer: ReturnType<typeof setTimeout> | undefined

/** Lift-off: a boost right after the launch, then keep cruising. */
export function propelStarfield() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  clearTimeout(boostTimer)
  thrust = { targetSpeed: BOOST_SPEED, responseMs: 700 }
  boostTimer = setTimeout(() => (thrust = { targetSpeed: CRUISE_SPEED, responseMs: 1500 }), BOOST_MS)
  run()
}

/** Engines off: the stars slow down and come to rest where they are. */
export function stopStarfield() {
  clearTimeout(boostTimer)
  thrust = { targetSpeed: 0, responseMs: 400 }
}

function run() {
  if (frame !== undefined) return
  lastTime = undefined
  frame = requestAnimationFrame(tick)
}

function tick(time: number) {
  // Cap the step, so returning to a background tab does not make the stars jump.
  const seconds = lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, 0.1)
  lastTime = time

  speed += (thrust.targetSpeed - speed) * (1 - Math.exp((-seconds * 1000) / thrust.responseMs))
  offset += speed * seconds

  const style = document.body.style
  style.setProperty('--stars-near', `${offset.toFixed(1)}px`)
  style.setProperty('--stars-far', `${(offset * FAR_LAYER_RATIO).toFixed(1)}px`)

  if (thrust.targetSpeed === 0 && speed < 1) {
    speed = 0
    frame = undefined
    return
  }
  frame = requestAnimationFrame(tick)
}
