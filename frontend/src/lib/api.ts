// Thin wrapper around the .NET API. Requests are relative: the page is always served by .NET,
// directly in production and through its dev proxy during development.

export type TeamMember = {
  id: number
  name: string
}

export type Pair = {
  number: number
  members: TeamMember[]
}

export type Round = {
  id: number
  startedAt: string
  completedAt: string | null
  pairs: Pair[]
  /** Members still on the wheel. Empty once the round is complete. */
  remaining: TeamMember[]
}

export type SpinResult = {
  picked: TeamMember
  round: Round
}

type ProblemDetails = {
  title?: string
  detail?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!response.ok) {
    const problem: ProblemDetails = await response.json().catch(() => ({}))
    const validationMessage = problem.errors && Object.values(problem.errors).flat()[0]
    throw new ApiError(response.status, problem.detail ?? validationMessage ?? problem.title ?? response.statusText)
  }

  return response.status === 204 ? (undefined as T) : response.json()
}

export const teamMembersApi = {
  list: () => request<TeamMember[]>('/team-members'),
  add: (name: string) => request<TeamMember>('/team-members', { method: 'POST', body: JSON.stringify({ name }) }),
  remove: (id: number) => request<void>(`/team-members/${id}`, { method: 'DELETE' }),
}

export const roundsApi = {
  /** All rounds, newest first. */
  list: () => request<Round[]>('/rounds'),
  start: () => request<Round>('/rounds', { method: 'POST' }),
  spin: (roundId: number) => request<SpinResult>(`/rounds/${roundId}/spins`, { method: 'POST' }),
  undoLastSpin: (roundId: number) => request<Round>(`/rounds/${roundId}/spins/last`, { method: 'DELETE' }),
  undo: (roundId: number) => request<void>(`/rounds/${roundId}`, { method: 'DELETE' }),
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}
