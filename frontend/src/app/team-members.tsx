'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { ApiError, type TeamMember, teamMembersApi } from '@/lib/api'

export function TeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    teamMembersApi
      .list()
      .then(setMembers)
      .catch(() => setError('Could not load the team. Is the API running?'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const member = await teamMembersApi.add(name)
      setMembers((current) => [...current, member].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add the team member.')
    }
  }

  async function handleRemove(member: TeamMember) {
    setError(null)
    try {
      await teamMembersApi.remove(member.id)
      setMembers((current) => current.filter((m) => m.id !== member.id))
    } catch {
      setError(`Could not remove ${member.name}.`)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-medium">Team</h2>

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
          className="flex-1 rounded-md border border-foreground/20 bg-transparent px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-foreground px-4 py-2 text-background">
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-foreground/70">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-foreground/70">No team members yet. Add the first one above.</p>
      ) : (
        <ul className="divide-y divide-foreground/10 rounded-md border border-foreground/20">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-3 py-2">
              <span>{member.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(member)}
                className="text-sm text-foreground/60 hover:text-foreground"
                aria-label={`Remove ${member.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
