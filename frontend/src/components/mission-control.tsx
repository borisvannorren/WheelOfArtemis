'use client'

import { useEffect, useRef, useState } from 'react'
import { errorMessage, type Round, roundsApi, type TeamMember, teamMembersApi } from '@/lib/api'
import { missionMonth, missionName } from '@/lib/mission'
import { CrewList } from './crew-list'
import { MissionLog } from './mission-log'
import { TeamPanel } from './team-panel'
import { rotationFor, Wheel } from './wheel'

const SPIN_DURATION_MS = 4500
const REDUCED_MOTION_DURATION_MS = 400

type WheelState = { rotation: number; durationMs: number }

export function MissionControl() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wheel, setWheel] = useState<WheelState>({ rotation: 0, durationMs: 0 })
  const [lastPicked, setLastPicked] = useState<TeamMember | null>(null)
  const spinTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    Promise.all([teamMembersApi.list(), roundsApi.list()])
      .then(([loadedMembers, loadedRounds]) => {
        setMembers(loadedMembers)
        setRounds(loadedRounds)
      })
      .catch(() => setError('Could not reach mission control. Is the API running?'))
      .finally(() => setLoading(false))

    return () => clearTimeout(spinTimer.current)
  }, [])

  const latest = rounds[0]
  const current = latest && latest.completedAt === null ? latest : undefined
  const wheelMembers = current ? current.remaining : members

  function replaceRound(round: Round) {
    setRounds((all) => all.map((r) => (r.id === round.id ? round : r)))
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e, fallback))
    } finally {
      setBusy(false)
    }
  }

  function handleStart() {
    return run(async () => {
      const round = await roundsApi.start()
      setRounds((all) => [round, ...all])
      setLastPicked(null)
    }, 'Could not start the mission.')
  }

  async function handleLaunch() {
    if (!current) return
    setBusy(true)
    setError(null)
    setLastPicked(null)

    try {
      // The backend decides and saves the outcome; the wheel then turns to it.
      const result = await roundsApi.spin(current.id)
      const index = current.remaining.findIndex((m) => m.id === result.picked.id)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const durationMs = reducedMotion ? REDUCED_MOTION_DURATION_MS : SPIN_DURATION_MS
      const turns = reducedMotion ? 0 : 5 + Math.floor(Math.random() * 3)

      setWheel({ rotation: rotationFor(index, current.remaining.length, turns, Math.random() - 0.5), durationMs })

      spinTimer.current = setTimeout(() => {
        replaceRound(result.round)
        setLastPicked(result.picked)
        setWheel({ rotation: 0, durationMs: 0 })
        setBusy(false)
      }, durationMs + 300)
    } catch (e) {
      setError(errorMessage(e, 'The launch failed. Try again.'))
      setBusy(false)
    }
  }

  function handleUndoLastSpin() {
    if (!latest) return
    return run(async () => {
      replaceRound(await roundsApi.undoLastSpin(latest.id))
      setLastPicked(null)
    }, 'Could not undo the last spin.')
  }

  function handleScrub(round: Round) {
    const name = `${missionName(round, rounds)} (${missionMonth(round)})`
    if (!window.confirm(`Scrub ${name}? Its crews are removed and no longer count for future missions.`)) return
    return run(async () => {
      await roundsApi.undo(round.id)
      setRounds((all) => all.filter((r) => r.id !== round.id))
      setLastPicked(null)
    }, 'Could not scrub the mission.')
  }

  if (loading) {
    return <p className="font-mono text-sm tracking-widest text-lunar-400 uppercase">Establishing contact…</p>
  }

  const shownRound = current ?? latest
  const canUndoSpin = !!latest && latest.pairs.length > 0

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="rounded-md border border-signal-500/40 bg-signal-500/10 px-4 py-3 text-signal-400">
          {error}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="panel flex flex-col items-center gap-6" aria-labelledby="wheel-heading">
          <div className="flex w-full items-baseline justify-between gap-4">
            <h2 id="wheel-heading" className="panel-heading">
              {current ? `${missionName(current, rounds)} · ${missionMonth(current)}` : 'Launch pad'}
            </h2>
            <span className="font-mono text-xs tracking-widest text-lunar-400 uppercase">
              {current ? `${current.remaining.length} on the wheel` : 'Standing by'}
            </span>
          </div>

          <Wheel members={wheelMembers} rotation={wheel.rotation} durationMs={wheel.durationMs} />

          <p aria-live="polite" className="min-h-7 text-center font-mono text-lg tracking-widest uppercase">
            {lastPicked && (
              <>
                <span className="text-signal-400">{lastPicked.name}</span>
                <span className="text-lunar-300"> is on board</span>
              </>
            )}
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {current ? (
              <button type="button" onClick={handleLaunch} disabled={busy} className="button-primary">
                Launch
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={busy || members.length < 2}
                className="button-primary"
              >
                Start new mission
              </button>
            )}
            {canUndoSpin && (
              <button type="button" onClick={handleUndoLastSpin} disabled={busy} className="button-secondary">
                Undo last spin
              </button>
            )}
            {current && (
              <button type="button" onClick={() => handleScrub(current)} disabled={busy} className="button-secondary">
                Scrub mission
              </button>
            )}
          </div>

          {!current && members.length < 2 && (
            <p className="text-sm text-lunar-400">Add at least two crew members to start a mission.</p>
          )}
        </section>

        <section className="panel flex flex-col gap-4" aria-labelledby="crew-heading">
          <h2 id="crew-heading" className="panel-heading">
            Crew assignments
          </h2>
          {shownRound ? (
            <>
              <p className="font-mono text-xs tracking-widest text-lunar-400 uppercase">
                {missionName(shownRound, rounds)} · {missionMonth(shownRound)} ·{' '}
                {shownRound.completedAt ? 'mission complete' : 'in progress'}
              </p>
              <CrewList pairs={shownRound.pairs} highlightId={lastPicked?.id} />
              {shownRound.completedAt && (
                <p className="text-sm text-lunar-300">
                  Every crew member has a buddy. Give each other feedback this month, and ask for it too.
                </p>
              )}
            </>
          ) : (
            <p className="text-lunar-400">No missions yet. Start the first one on the launch pad.</p>
          )}
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <TeamPanel members={members} locked={!!current} onChange={setMembers} />
        <MissionLog rounds={rounds} busy={busy} onScrub={handleScrub} />
      </div>
    </div>
  )
}
