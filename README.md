# Wheel of Artemis

Team Artemis is practising how to give and ask for feedback. Every month we pair team members up as **Feedback Buddies**: two colleagues who agree to give each other feedback and ask each other for it during that month.

Wheel of Artemis makes choosing those pairs a small team moment instead of a spreadsheet exercise. It is an Artemis-themed wheel of fortune that you spin until everyone has a buddy, and it remembers earlier rounds.

The app runs locally. It is not deployed anywhere.

## How a round works

1. **Manage the team.** Add and remove team members on the page. Removed members are deactivated, not deleted, so earlier rounds keep their history.
2. **Spin.** The wheel lands on one name, and that person leaves the wheel.
3. **Pair up.** Every two names picked form a buddy pair. Buddies are mutual: both give feedback and ask for it, so the order of picking does not matter.
4. **Odd team size.** When one person is left over, they join the last pair, which then becomes a trio.
5. **Save the round.** When everyone has a buddy, the round is stored, so the team can look back at earlier pairings and the wheel can later avoid repeating recent pairs.

> **Status:** the foundation is in place: architecture, database, and team management. The wheel, rounds and history are the next step. See [Next steps](#next-steps).

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

- **Backend:** ASP.NET Core on .NET 10 with minimal APIs, EF Core with Npgsql, and OpenAPI with the Scalar UI (Development only). Migrations are applied automatically on startup.
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
| `just fe-lint` / `just fe-format` | ESLint / Prettier for the frontend |
| `just be-build` | Build the backend |
| `just migration-add <Name>` | Create an EF Core migration after changing the data model |
| `just psql` | Open a psql shell on the database |
| `just db-reset` | Delete all data and start with an empty, migrated database |
| `just prod-up` / `just prod-down` | Build and run the production image on port 5001 |

Dev containers run as your own user, so files they create (such as `node_modules` and migrations) are owned by you, not by root. `node_modules` is installed into `frontend/` on the host, so your editor gets type information.

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
│   └── src/WheelOfArtemis.Api/
│       ├── Program.cs
│       ├── Data/            # DbContext and migrations
│       ├── Features/        # One folder per feature: entity, configuration, endpoints
│       └── Hosting/         # How .NET serves the frontend (YARP in dev, wwwroot in prod)
└── frontend/
    ├── next.config.ts       # Static export settings
    └── src/
        ├── app/             # Pages and components
        └── lib/api.ts       # Typed fetch wrapper around /api
```

## Data and privacy

The app stores team members' names and, in the next step, which people were paired in which month. It does **not** store any feedback content. Feedback stays between the buddies.

The data lives in a Postgres volume on the machine that runs the app. The database and the app are bound to `127.0.0.1` and are not reachable from the network. Names and pairings of colleagues are personal data, even if low-risk. Keep the data to what the app needs, and run `just db-reset` to remove it when it is no longer needed.

## Next steps

- The wheel: spin animation, picking one person per spin, and forming pairs and a trio
- Rounds and pair history (`Round`, `Pair` and `PairMember`, which supports trios), plus an overview of earlier months
- Avoiding pairs that were matched recently
- Unit tests for the pairing logic (xUnit)
- Artemis theme: moon, bow and arrow as the wheel's pointer
- Optionally, a TypeScript client generated from the OpenAPI document instead of the hand-written `api.ts`
