import type { Pair, TeamMember } from '@/lib/api'

type CrewListProps = {
  pairs: Pair[]
  highlightIds?: number[]
}

/** The buddy pairs of a round, shown as crews. A pair with one member is still waiting for a buddy. */
export function CrewList({ pairs, highlightIds = [] }: CrewListProps) {
  if (pairs.length === 0) {
    return <p className="text-lunar-400">No crews assigned yet. Launch the wheel to pick the first crew member.</p>
  }

  return (
    <ol className="flex flex-col gap-2">
      {pairs.map((pair) => (
        <li
          key={pair.number}
          className="flex items-baseline gap-4 rounded-lg border border-white/10 bg-space-800/60 px-4 py-3"
        >
          <span className="w-16 shrink-0 font-mono text-xs tracking-widest text-lunar-400 uppercase">
            Crew {pair.number}
          </span>
          <span className="flex flex-wrap items-baseline gap-x-2">
            {pair.members.map((member, index) => (
              <CrewMember
                key={member.id}
                member={member}
                highlight={highlightIds.includes(member.id)}
                first={index === 0}
              />
            ))}
            {pair.members.length === 1 && <span className="text-lunar-400 italic">awaiting buddy…</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function CrewMember({ member, highlight, first }: { member: TeamMember; highlight: boolean; first: boolean }) {
  return (
    <>
      {!first && <span className="text-lunar-500">+</span>}
      <span className={highlight ? 'font-semibold text-signal-400' : 'text-lunar-100'}>{member.name}</span>
    </>
  )
}
