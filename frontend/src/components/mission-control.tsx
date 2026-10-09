'use client'

import { useEffect, useRef, useState } from 'react'
import { errorMessage, type Round, roundsApi, type TeamMember, teamMembersApi } from '@/lib/api'
import { celebrateFinalCrew, fireCrewCannon, type ViewportPoint } from '@/lib/celebrations'
import { memberColor } from '@/lib/member-color'
import { stopStarfield } from '@/lib/starfield'
import { missionMonth, missionName } from '@/lib/mission'
import { CrewList } from './crew-list'
import { MissionLog } from './mission-log'
import { TeamPanel } from './team-panel'
import { rotationFor, Wheel } from './wheel'

const SPIN_DURATION_MS = 4500
const REDUCED_MOTION_DURATION_MS = 400

type WheelState = { rotation: number; durationMs: number }

/** What the last launch did: put one member on board, or assign the final crew. */
type Launched = { members: TeamMember[]; finalCrew: boolean }

export function MissionControl() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wheel, setWheel] = useState<WheelState>({ rotation: 0, durationMs: 0 })
  const [launched, setLaunched] = useState<Launched | null>(null)
  const spinTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const crewPanel = useRef<HTMLElement>(null)

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
      setLaunched(null)
    }, 'Could not start the mission.')
  }

  async function handleLaunch() {
    if (!current) return
    setBusy(true)
    setError(null)
    setLaunched(null)

    try {
      // The backend decides and saves the outcome; the wheel then turns to it.
      const result = await roundsApi.spin(current.id)

      if (current.finalCrewNext) {
        // Nothing left to choose: the remaining members form the final crew without a spin.
        const finalCrew = result.round.pairs.at(-1)?.members ?? result.picked
        replaceRound(result.round)
        setLaunched({ members: finalCrew, finalCrew: true })
        setBusy(false)
        void celebrateFinalCrew()
        return
      }

      const [picked] = result.picked
      const index = current.remaining.findIndex((m) => m.id === picked.id)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const durationMs = reducedMotion ? REDUCED_MOTION_DURATION_MS : SPIN_DURATION_MS
      const turns = reducedMotion ? 0 : 5 + Math.floor(Math.random() * 3)

      setWheel({ rotation: rotationFor(index, current.remaining.length, turns, Math.random() - 0.5), durationMs })

      spinTimer.current = setTimeout(() => {
        replaceRound(result.round)
        setLaunched({ members: [picked], finalCrew: false })

        // A crew is complete when the pick joined someone who was waiting for a buddy. The cannon fires from that
        // crew's row in the crew assignments, after React has rendered the new buddy into it.
        const crew = result.round.pairs.find((pair) => pair.members.some((m) => m.id === picked.id))
        if (crew && crew.members.length > 1) {
          requestAnimationFrame(() => {
            const row = crewPanel.current?.querySelector(`[data-crew="${crew.number}"]`)
            void fireCrewCannon(
              crew.members.map((m) => memberColor(m.id)),
              centreOf(row),
            )
          })
        }
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
      setLaunched(null)
      stopStarfield()
    }, 'Could not undo the last launch.')
  }

  function handleScrub(round: Round) {
    const name = `${missionName(round, rounds)} (${missionMonth(round)})`
    if (!window.confirm(`Scrub ${name}? Its crews are removed and no longer count for future missions.`)) return
    return run(async () => {
      await roundsApi.undo(round.id)
      setRounds((all) => all.filter((r) => r.id !== round.id))
      setLaunched(null)
      stopStarfield()
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
            {launched?.finalCrew && (
              <>
                <span className="text-lunar-300">Final crew: </span>
                <span className="text-signal-400">{launched.members.map((m) => m.name).join(' + ')}</span>
              </>
            )}
            {launched && !launched.finalCrew && (
              <>
                <span className="text-signal-400">{launched.members[0].name}</span>
                <span className="text-lunar-300"> is on board</span>
              </>
            )}
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            {current ? (
              <button type="button" onClick={handleLaunch} disabled={busy} className="button-primary">
                {current.finalCrewNext ? 'Launch final crew' : 'Launch'}
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
                Undo last launch
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

        <section ref={crewPanel} className="panel flex flex-col gap-4" aria-labelledby="crew-heading">
          <h2 id="crew-heading" className="panel-heading">
            Crew assignments
          </h2>
          {shownRound ? (
            <>
              <p className="font-mono text-xs tracking-widest text-lunar-400 uppercase">
                {missionName(shownRound, rounds)} · {missionMonth(shownRound)} ·{' '}
                {shownRound.completedAt ? 'mission complete' : 'in progress'}
              </p>
              <CrewList pairs={shownRound.pairs} highlightIds={launched?.members.map((m) => m.id)} />
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

/**
 * Centre of an element as fractions of the viewport, kept on screen so a burst stays visible when the element is
 * scrolled out of view. The middle of the screen when the element is not rendered.
 */
function centreOf(element: Element | null | undefined): ViewportPoint {
  if (!element) return { x: 0.5, y: 0.5 }
  const rect = element.getBoundingClientRect()
  const clamp = (value: number) => Math.min(0.95, Math.max(0.05, value))
  return {
    x: clamp((rect.left + rect.width / 2) / window.innerWidth),
    y: clamp((rect.top + rect.height / 2) / window.innerHeight),
  }
}
