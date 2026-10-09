import { MissionControl } from '@/components/mission-control'

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.3em] text-signal-400 uppercase">Team Artemis · Feedback Buddies</p>
        <h1 className="text-4xl font-semibold tracking-tight text-lunar-100 sm:text-5xl">Wheel of Artemis</h1>
        <p className="max-w-2xl text-lunar-300">
          Every month the wheel assigns each crew member a feedback buddy. Buddies give each other feedback and ask for
          it, until the next mission.
        </p>
      </header>

      <MissionControl />

      <footer className="flex flex-col gap-1 border-t border-white/10 pt-6 text-xs text-lunar-500">
        <p>
          Team Artemis is part of{' '}
          <a
            href="https://dev.hoppinger.com/"
            target="_blank"
            rel="noreferrer"
            className="text-lunar-300 underline underline-offset-2 hover:text-signal-400"
          >
            Hoppinger Development
          </a>
          .
        </p>
        <p>
          This frontend is largely vibe coded: it was generated with AI and has had limited review. Expect rough edges.
        </p>
        <p>Inspired by NASA&apos;s Artemis program. Not affiliated with or endorsed by NASA.</p>
      </footer>
    </main>
  )
}
