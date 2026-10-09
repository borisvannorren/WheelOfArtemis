# Wheel of Artemis

Team Artemis is practising how to give and ask for feedback. Every month we pair team members up as **Feedback Buddies**: two colleagues who agree to give each other feedback and ask each other for it during that month.

Wheel of Artemis makes choosing those pairs a small team moment instead of a spreadsheet exercise. It is an Artemis-themed wheel of fortune that you spin until everyone has a buddy, and it remembers earlier rounds.

The app runs locally. It is not deployed anywhere.

> **Note:** this application is 100% vibe coded: the whole codebase, frontend and backend, was generated with AI. The backend pairing logic is covered by unit tests; the frontend has no automated tests yet. The page shows the same notice in its footer.

## How a round works

The app is themed after NASA's Artemis program, so a round is a **mission**, the team is the **crew roster**, and a buddy pair is a **crew**.

1. **Manage the crew roster.** Add and remove team members. Removed members are deactivated, not deleted, so earlier missions keep their history. The roster is locked while a mission is in progress.
2. **Start a mission.** This needs at least two team members. Missions are numbered like the real ones (Mission I, II, III…) and labelled with the month they started.
3. **Launch.** The wheel, drawn as the Moon, spins and the lander points at one name. That person leaves the wheel.
4. **Pair up.** Every two names form a crew of feedback buddies. Buddies are mutual: both give feedback and ask for it.
5. **Odd team size.** When one person is left after the last pair, they join that pair, which becomes a trio.
6. **Mission complete.** When everyone has a buddy, the mission moves to the mission log.

**Every spin is saved immediately.** Closing the page in the middle of a mission is fine; it continues where it stopped.

**Undo.** *Undo last spin* takes back the most recent pick of the latest mission, including the final pick of a completed mission, which reopens it. *Scrub* removes a whole mission, for example when the result is unwanted. A scrubbed mission no longer counts for repeat avoidance.

### How repeats are avoided

The first person of each crew is picked at random. Their buddy is picked at random from the people they were paired with **least recently**: someone they have never been paired with first, then someone from longer ago. A pairing from last month always weighs more than all older pairings combined.

The wheel also looks ahead. It only picks a buddy if the people still on the wheel can be paired at least as well, so an early pick never forces a repeat at the end that could have been avoided. When a repeat is unavoidable, for example in a small team or because of a trio, the wheel picks the least recent one. The last 24 missions are taken into account.

The backend decides the outcome of each spin and saves it before the wheel starts turning; the animation then turns the wheel to that name. The logic lives in `SpinPlanner` and is covered by unit tests.

## Architecture

The .NET application is the leading application. It serves the API and the frontend from a single address. Next.js is used only to build the frontend. There is no Next.js server in production.

```
                        Development                                  Production (just prod-up)

 Browser ──▶ http://localhost:5000                         Browser ──▶ http://localhost:5001
              │                                                         │
              ▼                                                         ▼
        ┌───────────────┐   /api, /health, /scalar           ┌──────────────────────────┐
        │  backend      │──────────────▶ minimal APIs        │  app (.NET)              │
        │  .NET (watch) │                    │               │  /api  ──▶ minimal APIs  │
        │               │   everything else  │               │  other ──▶ wwwroot       │
        │      YARP ────┼──────────┐         │               │  (static Next.js export) │
        └───────────────┘          ▼         ▼               └────────────┬─────────────┘
                          ┌──────────────┐ ┌──────────┐                   ▼
                          │ frontend     │ │ postgres │              ┌──────────┐
                          │ next dev     │ └──────────┘              │ postgres │
                          └──────────────┘                           └──────────┘
```

- **Backend:** ASP.NET Core on .NET 10 with minimal APIs, EF Core with Npgsql, and OpenAPI with the Scalar UI (Development only). Migrations are applied automatically on startup. Unit tests use xUnit v3 on Microsoft.Testing.Platform.
- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS), configured as a [static export](https://nextjs.org/docs/app/guides/static-exports). Pages fetch their data in the browser from `/api` on the same origin, so no CORS is needed.
- **Development:** .NET forwards every request it does not handle itself to the Next.js dev server with [YARP](https://learn.microsoft.com/aspnet/core/fundamentals/servers/yarp/yarp-overview). Hot reload works for both: `dotnet watch` for the backend, and Next.js HMR through the proxy for the frontend.
- **Production image:** a multi-stage `Dockerfile` builds the Next.js export, publishes the .NET app, and copies the export into the app's `wwwroot`. The result is one container.
- **Database:** PostgreSQL 18 in a Docker volume.

Because the frontend is a static export, Next.js features that need a server are not available. These include server actions, request-time route handlers, rewrites, middleware/proxy and image optimisation. Anything dynamic belongs in the .NET API.

## Getting started

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) with Compose v2, and [just](https://github.com/casey/just). Node, npm and the .NET SDK are **not** needed on your machine, because all tooling runs in containers.

```sh
cp .env.example .env   # local database credentials and ports
just up                # build and start frontend, backend and Postgres
```

Then open:

| URL | What |
| --- | --- |
| http://localhost:5000 | The app |
| http://localhost:5000/scalar | API reference (Development only) |
| http://localhost:5000/health | Health check, including the database |

The first start takes a minute while images build and packages restore. Follow progress with `just logs`.

Ports are set in `.env` (`APP_PORT`, `PROD_APP_PORT`, `POSTGRES_HOST_PORT`). Postgres is published on `127.0.0.1:5433` so it does not clash with other projects that use 5432.

## Common commands

Run `just` to see all recipes. The ones you will use most:

| Command | What it does |
| --- | --- |
| `just up` / `just down` | Start or stop the development stack (data is kept) |
| `just logs [service]` | Follow logs, for example `just logs backend` |
| `just fe-add <pkg>` | Add an npm package (`just fe-add -D <pkg>` for dev dependencies) |
| `just fe-lint` / `just fe-format` / `just fe-typecheck` | ESLint / Prettier / TypeScript for the frontend |
| `just be-build` / `just be-test` | Build / test the backend |
| `just migration-add <Name>` | Create an EF Core migration after changing the data model (`just migration-remove` undoes an unapplied one) |
| `just psql` | Open a psql shell on the database |
| `just db-reset` | Delete all data and start with an empty, migrated database |
| `just prod-up` / `just prod-down` | Build and run the production image on port 5001 |

Dev containers run as your own user, so files they create (such as `node_modules` and migrations) are owned by you, not by root. `node_modules` is installed into `frontend/` on the host, so your editor gets type information.

Don't run `next build` in `frontend/` while the dev stack is running: it shares the `.next` folder with the dev server and breaks its CSS updates. The full frontend build only runs inside the production image (`just prod-up`). If styles still look stale, stop the frontend, delete `frontend/.next` and start it again.

## Project structure

```
├── Dockerfile               # All build stages: frontend-dev, frontend-build, backend-dev, backend-build, runtime
├── docker-compose.yaml      # postgres, frontend, backend, and app (profile "prod")
├── justfile                 # All project commands
├── backend/
│   ├── WheelOfArtemis.slnx
│   ├── global.json          # Pins the .NET SDK major version
│   ├── Directory.*.props    # Shared build settings and central package versions
│   ├── dotnet-tools.json    # dotnet-ef as a local tool
│   ├── src/WheelOfArtemis.Api/
│   │   ├── Program.cs
│   │   ├── Data/            # DbContext and migrations
│   │   ├── Features/        # One folder per feature: entities, endpoints and logic
│   │   │   ├── TeamMembers/
│   │   │   └── Rounds/      # Rounds, picks, and SpinPlanner (pairing and repeat avoidance)
│   │   └── Hosting/         # How .NET serves the frontend (YARP in dev, wwwroot in prod)
│   └── tests/WheelOfArtemis.Api.Tests/
└── frontend/
    ├── next.config.ts       # Static export settings
    └── src/
        ├── app/             # Page, layout and theme (globals.css)
        ├── components/      # Mission control, the wheel, crew list, roster and mission log
        └── lib/             # Typed fetch wrapper around /api, mission naming
```

## Data and privacy

The app stores team members' names and which people were paired in which mission. It does **not** store any feedback content. Feedback stays between the buddies. A scrubbed mission is deleted, not hidden.

The data lives in a Postgres volume on the machine that runs the app. The database and the app are bound to `127.0.0.1` and are not reachable from the network. Names and pairings of colleagues are personal data, even if low-risk. Keep the data to what the app needs, and run `just db-reset` to remove it when it is no longer needed.

## Theme

The look is inspired by NASA's Artemis program: a starfield, the Moon as the wheel, and a lander as the pointer. The app does not use NASA's logos, insignia or other official artwork. Those are protected and may not be reused without permission, so keep it that way when changing the theme. The footer states that the app is not affiliated with NASA.

## Possible improvements

- Integration tests for the API endpoints against a real Postgres database (for example with Testcontainers)
- A TypeScript client generated from the OpenAPI document instead of the hand-written `api.ts`
- Sound or a short countdown before launch
