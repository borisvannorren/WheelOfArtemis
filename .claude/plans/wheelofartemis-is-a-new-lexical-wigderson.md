# Plan: WheelOfArtemis foundation (README, .NET + Next.js scaffold, Docker, Postgres)

## Context

Team Artemis wants to practise giving and asking for feedback through monthly "Feedback Buddies". WheelOfArtemis is a small, locally run app with an Artemis-themed wheel of fortune that pairs team members. The repository holds only a Node-flavoured `.gitignore`.

This step lays the foundation: README, freshly scaffolded backend and frontend, Docker setup, Postgres and a justfile, plus one thin feature (team members) that proves browser → .NET → Postgres works end to end. The wheel, pairing and history come in the next step.

**Architecture, as the user decided.** The .NET app is the leading application, as in RotterdamPartners. It serves the API and the frontend from one origin (http://localhost:5000). Next.js is only the frontend.

What we take from RotterdamPartners:
- compose + justfile workflow
- Postgres container
- EF Core migrations
- multi-stage production image in which the frontend build lands in the .NET app's `wwwroot`

What we deliberately do differently:
- Next.js instead of webpack + Razor.
- .NET also runs in a container during development, using `dotnet watch`.
- Minimal hosting and minimal APIs instead of `WebHost` + `Startup`.
- Pinned image versions.
- No trust auth on Postgres.

Other decisions:
- **Data:** team members are managed in the UI and stored in Postgres. Pair history goes in Postgres too, in the next step.
- **Pairing flow (next step):** one spin picks one person, who leaves the wheel. Every two picks form a mutual buddy pair. With an odd team size, the last person joins the final pair as a trio.
- **Package manager:** npm, used only inside the container.

## How .NET leads and Next.js stays "headless"

- **Next.js is a static export** (`output: 'export'`, `trailingSlash: true`, `images.unoptimized`). It has no Next.js server at runtime. All data comes from client-side `fetch('/api/...')` to .NET on the same origin, so CORS is not needed.
- **Production image:**
  - `next build` produces `out/`.
  - It is copied into `wwwroot` of the published .NET app.
  - .NET serves it with `UseDefaultFiles` + `UseStaticFiles` + `MapFallbackToFile("index.html")`.
- **Development:** .NET forwards every non-`/api`, non-`/openapi`, non-`/health` request to the `next dev` container through **YARP** (`Yarp.ReverseProxy`, Development only, catch-all route with the lowest priority). HMR websockets pass through YARP, so the frontend keeps hot reload. Developers always open http://localhost:5000.
- **Constraint:** a static export cannot use server actions, route handlers, or request-time server components. That suits an interactive single-page tool. The README will mention it so nobody is surprised later.

## Scaffolding (official templates, then trimmed)

- **Backend:** `dotnet` CLI on the host (SDK 10.0.109 present, allowed by the global instructions):
  - `dotnet new sln` (.slnx)
  - `dotnet new webapi --use-minimal-apis` (or the .NET 10 equivalent; no controllers)
  - `dotnet new gitignore`, merged into the root `.gitignore`
- **Frontend:** a one-off `docker run --rm -u $(id -u):$(id -g) -v $PWD:/work -w /work node:24-alpine npx create-next-app@latest frontend --ts --eslint --app --src-dir --tailwind --use-npm --import-alias "@/*"`. Nothing runs on the host. The resolved Next.js version is whatever is current, and it gets locked in `package-lock.json`.
- **Cleanup:** remove template sample code (WeatherForecast, Next.js boilerplate page and assets).

## Target layout

```
README.md
justfile
docker-compose.yaml
Dockerfile                     # all stages: frontend-dev, frontend-build, backend-dev, backend-build, runtime
.dockerignore  .editorconfig  .env.example  .gitignore (extended)
backend/
  WheelOfArtemis.slnx
  global.json                  # pin SDK 10.0.x, rollForward latestFeature
  Directory.Build.props        # net10.0, Nullable, ImplicitUsings, TreatWarningsAsErrors
  Directory.Packages.props     # central package management
  .config/dotnet-tools.json    # dotnet-ef as local tool
  src/WheelOfArtemis.Api/
    Program.cs
    Data/AppDbContext.cs, Data/Migrations/
    Features/TeamMembers/TeamMember.cs, TeamMemberEndpoints.cs
frontend/                      # create-next-app output, trimmed
  next.config.ts               # output export, trailingSlash, images.unoptimized
  src/app/page.tsx             # team member list + add form (proof of wiring)
  src/lib/api.ts               # small typed fetch wrapper around /api
```

## Backend details (`backend/src/WheelOfArtemis.Api/Program.cs`)

- `WebApplication.CreateBuilder`, minimal APIs grouped under `MapGroup("/api")`.
- **Packages** (versions in `Directory.Packages.props`):
  - `Npgsql.EntityFrameworkCore.PostgreSQL` 10.x and `Microsoft.EntityFrameworkCore.Design`
  - `Microsoft.AspNetCore.OpenApi` (built-in `AddOpenApi`/`MapOpenApi`) and `Scalar.AspNetCore` for the docs UI, Development only
  - `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`, for `/health` with a DbContext check
  - `Yarp.ReverseProxy`, Development only
- **Connection string:** `ConnectionStrings__Default` from the environment. No secrets in `appsettings.json`.
- **Migrations:** applied at startup with `await db.Database.MigrateAsync()`. This is acceptable for a single-instance local tool and means `just up` is the only step needed. Migrations are created via `just migration-add <Name>`, which runs `dotnet ef` in the backend container.
- **Foundation entity `TeamMember`:** `Id`, `Name` (required, max 100, unique), `IsActive`, `CreatedAt`. Endpoints: `GET /api/team-members`, `POST /api/team-members` (validated, returns `201`/`400`/`409`), `DELETE /api/team-members/{id}` (soft delete via `IsActive=false`, because future pair history references members). Rounds and pairs follow in the next step.
- Production serving of `wwwroot` as described above.

## Docker

- **Images:** `node:24-alpine`, `mcr.microsoft.com/dotnet/sdk:10.0`, `mcr.microsoft.com/dotnet/aspnet:10.0`, `postgres:18-alpine`. Major versions are pinned.
- **compose services** (one network):
  - `postgres`: `127.0.0.1:5433:5432`. The port is 5433 so it does not clash with other projects' Postgres on 5432. Named volume `pgdata`, credentials from `.env`, healthcheck with `pg_isready`.
  - `backend`: target `backend-dev`, `dotnet watch run`, bind mount `./backend`, anonymous volumes for `bin/` and `obj/` so container and host IDE builds don't collide. Port `5000:8080`. `depends_on: postgres (service_healthy), frontend`. `Frontend__DevServerUrl=http://frontend:3000` for YARP.
  - `frontend`: target `frontend-dev`, `npm run dev`, bind mount `./frontend` with `node_modules` on the host (installed by the container as the host user, so VS Code gets type info). No host port, because it is reached through .NET.
  - `app` (profile `prod`): target `runtime`, the combined production image on `127.0.0.1:5001`, used to verify the static-export serving.
- Containers run as the host user (`user: "${USER_ID}:${GROUP_ID}"`, exported by the justfile), so generated files are not root-owned. Use the same names in compose and the Dockerfile; RotterdamPartners mixes `USER_ID` and `UID`.

## justfile (all tooling through containers)

`default` (list), `up`, `down`, `logs *svc`, `ps`, `restart svc`, `fe-install`, `fe-add *pkgs`, `fe-lint`, `fe-shell`, `be-build`, `be-shell`, `migration-add name`, `db-update`, `db-reset` (drop volume, migrate), `psql`, `prod-up` (builds and runs the `app` profile). Recipes use `set dotenv-load` and `export USER_ID := \`id -u\``.

## Housekeeping files

- **`.gitignore`:** add .NET `bin/`, `obj/`, `.vs/`, `*.user`, and `!.env.example`. The current `.env.*` rule would hide it.
- **`.editorconfig`:** C# 4 spaces, TS/JSON 2 spaces, LF, final newline.
- **Prettier:** `.prettierrc` in `frontend/` with the RotterdamPartners style (`semi: false, singleQuote: true, printWidth: 120`) + `just fe-format`.

## README.md contents

1. What it is and why (Feedback Buddies for team Artemis)
2. How a round works (spin per person, mutual pairs, trio for odd counts, history)
3. Architecture (diagram: browser → .NET :5000 → `/api` + Postgres; dev: YARP → next dev; prod: static export in wwwroot)
4. Getting started (prerequisites Docker + just; `cp .env.example .env`, `just up`, open localhost:5000; API docs at `/scalar`)
5. Common recipes
6. Project structure
7. Data and privacy: only first names and pairings are stored, never feedback content, in a local Docker volume. Colleagues' names and pairings are personal data, but low-risk; anyone running it removes it with `just db-reset`.
8. Status and next steps (wheel, rounds and pairs, avoid repeat pairs, Artemis theme)

## Out of scope / follow-ups

- Wheel UI, rounds, pairs and the history model. Planned model: `Round`, `Pair`, `PairMember`, which supports trios.
- Test project (xUnit). It is added in the next step together with the pairing logic, which is the first code worth unit-testing.
- Generated TS client from OpenAPI. Possible later; for now a small hand-written `api.ts`.
- **Git:** the branch is `main` with no JIRA key, so there is no ticket log. Commit only on request, then ask for the branch name and commit-message key.

## Verification

1. `just up` starts all three services, and `just ps` shows them healthy.
2. http://localhost:5000 shows the Next.js page through .NET. Editing `page.tsx` hot-reloads in the browser (checks the YARP websocket path; may need `allowedDevOrigins` in `next.config.ts`).
3. Add and remove a team member in the UI. `just psql` → `select * from "TeamMembers";` shows the rows. Restarting with `just down && just up` keeps them.
4. http://localhost:5000/health returns Healthy. `/scalar` shows the endpoints. A duplicate name returns 409.
5. `just fe-lint` and `just be-build` pass without warnings.
6. `just prod-up`: http://localhost:5001 serves the exported frontend from `wwwroot` with a working API, which confirms the production path without YARP.
7. `git status` shows no `bin/`, `obj/`, `node_modules/`, `.next/`, `out/` or `.env`.
