'use client'

import { type FormEvent, useState } from 'react'
import { errorMessage, type TeamMember, teamMembersApi } from '@/lib/api'

type TeamPanelProps = {
  members: TeamMember[]
  /** The team can't change while a round is in progress. */
  locked: boolean
  onChange: (members: TeamMember[]) => void
}

export function TeamPanel({ members, locked, onChange }: TeamPanelProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const member = await teamMembersApi.add(name)
      onChange([...members, member].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
    } catch (e) {
      setError(errorMessage(e, 'Could not add the crew member.'))
    }
  }

  async function handleRemove(member: TeamMember) {
    setError(null)
    try {
      await teamMembersApi.remove(member.id)
      onChange(members.filter((m) => m.id !== member.id))
    } catch (e) {
      setError(errorMessage(e, `Could not remove ${member.name}.`))
    }
  }

  return (
    <section className="panel flex flex-col gap-4" aria-labelledby="team-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="team-heading" className="panel-heading">
          Crew roster
        </h2>
        <span className="font-mono text-xs text-lunar-400">{members.length} members</span>
      </div>

      {locked && (
        <p className="rounded-md border border-earth-400/30 bg-earth-500/10 px-3 py-2 text-sm text-lunar-200">
          The roster is locked while a mission is in progress. Finish or scrub the mission to change it.
        </p>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <label htmlFor="member-name" className="sr-only">
          Name
        </label>
        <input
          id="member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          maxLength={100}
          required
          disabled={locked}
          className="flex-1 rounded-md border border-white/15 bg-space-950/60 px-3 py-2 text-lunar-100 placeholder:text-lunar-500 disabled:opacity-50"
        />
        <button type="submit" disabled={locked} className="button-secondary">
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-signal-400">
          {error}
        </p>
      )}

      {members.length === 0 ? (
        <p className="text-lunar-400">No crew yet. Add the first team member above.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-lunar-100">{member.name}</span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => handleRemove(member)}
                  className="text-sm text-lunar-400 hover:text-signal-400"
                  aria-label={`Remove ${member.name}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
