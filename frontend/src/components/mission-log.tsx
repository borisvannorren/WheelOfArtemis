import type { Round } from '@/lib/api'
import { missionMonth, missionName } from '@/lib/mission'
import { CrewList } from './crew-list'

type MissionLogProps = {
  rounds: Round[]
  busy: boolean
  onScrub: (round: Round) => void
}

/** Completed rounds, newest first. */
export function MissionLog({ rounds, busy, onScrub }: MissionLogProps) {
  const completed = rounds.filter((round) => round.completedAt !== null)

  return (
    <section className="panel flex flex-col gap-4" aria-labelledby="log-heading">
      <h2 id="log-heading" className="panel-heading">
        Mission log
      </h2>

      {completed.length === 0 ? (
        <p className="text-lunar-400">No completed missions yet.</p>
      ) : (
        <ol className="flex flex-col gap-6">
          {completed.map((round) => (
            <li key={round.id} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-mono text-sm tracking-widest text-lunar-200 uppercase">
                  {missionName(round, rounds)} <span className="text-lunar-500">· {missionMonth(round)}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onScrub(round)}
                  disabled={busy}
                  className="text-sm text-lunar-400 hover:text-signal-400 disabled:opacity-50"
                >
                  Scrub
                </button>
              </div>
              <CrewList pairs={round.pairs} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
