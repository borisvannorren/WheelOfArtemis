import type { TeamMember } from '@/lib/api'

const RADIUS = 100
const LABEL_RADIUS = 60
const SEGMENT_FILLS = ['#dddbd3', '#c6c3b9', '#d2d0c7', '#b9b6ac']

// Decorative craters, fixed to the wheel so they turn with it.
const CRATERS = [
  { x: -48, y: -52, r: 9 },
  { x: 55, y: -30, r: 6 },
  { x: 30, y: 62, r: 11 },
  { x: -62, y: 34, r: 5 },
  { x: 8, y: -78, r: 4 },
  { x: -20, y: 80, r: 6 },
  { x: 78, y: 28, r: 4 },
]

type WheelProps = {
  members: TeamMember[]
  /** Clockwise rotation in degrees. */
  rotation: number
  durationMs: number
}

/** The Moon as a wheel of fortune, with one segment per member and the lander as pointer. */
export function Wheel({ members, rotation, durationMs }: WheelProps) {
  const segmentAngle = members.length > 0 ? 360 / members.length : 360

  return (
    <svg viewBox="-115 -138 230 253" className="mx-auto w-full max-w-md" role="img" aria-label="Wheel of team members">
      <defs>
        <radialGradient id="moon-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#05070f" stopOpacity="0.35" />
        </radialGradient>
      </defs>

      <circle r={RADIUS + 6} fill="none" stroke="#5b9bd5" strokeOpacity="0.25" strokeWidth="2" />

      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: durationMs > 0 ? `transform ${durationMs}ms cubic-bezier(0.12, 0.7, 0.14, 1)` : 'none',
        }}
      >
        {members.length === 0 ? (
          <circle r={RADIUS} fill={SEGMENT_FILLS[1]} />
        ) : members.length === 1 ? (
          <circle r={RADIUS} fill={SEGMENT_FILLS[0]} />
        ) : (
          members.map((member, index) => (
            <path
              key={member.id}
              d={segmentPath(index * segmentAngle, (index + 1) * segmentAngle)}
              fill={SEGMENT_FILLS[index % SEGMENT_FILLS.length]}
              stroke="#8f8c83"
              strokeWidth="0.6"
            />
          ))
        )}

        {CRATERS.map((crater, index) => (
          <circle key={index} cx={crater.x} cy={crater.y} r={crater.r} fill="#05070f" fillOpacity="0.1" />
        ))}

        {members.map((member, index) => {
          const angle = members.length === 1 ? 0 : (index + 0.5) * segmentAngle
          const [x, y] = polar(members.length === 1 ? 0 : LABEL_RADIUS, angle)
          // Labels run along the radius; on the left half they are turned around so they never read upside down.
          const labelRotation = angle > 180 ? angle + 90 : angle - 90
          return (
            <text
              key={member.id}
              x={x}
              y={y}
              transform={members.length === 1 ? undefined : `rotate(${labelRotation} ${x} ${y})`}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-space-900 font-mono text-[9px] font-semibold tracking-wider uppercase"
            >
              {truncate(member.name, members.length > 10 ? 9 : 12)}
            </text>
          )
        })}
      </g>

      {/* Shading stays put while the wheel turns, so the light keeps coming from the same side. */}
      <circle r={RADIUS} fill="url(#moon-shade)" pointerEvents="none" />

      <circle r="13" className="fill-space-800" stroke="#a29f95" strokeWidth="1.5" />
      <circle r="4" className="fill-earth-400" />

      {/* Lander, pointing at the segment that is picked. */}
      <g aria-hidden="true">
        <path d="M -11 -134 L 11 -134 L 6 -116 L -6 -116 Z" className="fill-lunar-200" />
        <path d="M -6 -116 L 6 -116 L 0 -101 Z" className="fill-signal-500" />
        <circle cy="-127" r="3" className="fill-space-800" />
      </g>
    </svg>
  )
}

/** Point at the given distance from the centre, at an angle measured clockwise from 12 o'clock. */
function polar(radius: number, angleDegrees: number): [number, number] {
  const radians = (angleDegrees * Math.PI) / 180
  return [radius * Math.sin(radians), -radius * Math.cos(radians)]
}

function segmentPath(startAngle: number, endAngle: number) {
  const [x1, y1] = polar(RADIUS, startAngle)
  const [x2, y2] = polar(RADIUS, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M 0 0 L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

/**
 * The clockwise rotation that brings the given segment under the lander, after a number of full turns.
 * The offset (-0.5 to 0.5) moves the landing spot within the segment, so the wheel does not always stop dead centre.
 */
export function rotationFor(index: number, count: number, turns: number, offset: number) {
  const segmentAngle = 360 / count
  const target = (index + 0.5 + offset * 0.7) * segmentAngle
  return turns * 360 + ((360 - (target % 360)) % 360)
}
