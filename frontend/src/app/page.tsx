import { TeamMembers } from './team-members'

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Wheel of Artemis</h1>
        <p className="text-foreground/70">Monthly Feedback Buddies for team Artemis.</p>
      </header>
      <TeamMembers />
    </main>
  )
}
