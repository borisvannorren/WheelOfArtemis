set dotenv-load

# Dev containers run as the host user, so files they create (node_modules, migrations) are not owned by root.
export USER_ID := `id -u`
export GROUP_ID := `id -g`

# List available recipes
default:
    @just --list

# Build and start frontend, backend and Postgres in the background
[group('app')]
up:
    docker compose up -d --build
    @echo "Wheel of Artemis: http://localhost:${APP_PORT:-5000}"

# Stop and remove the containers (data is kept)
[group('app')]
down:
    docker compose down

# Follow logs, optionally for specific services (e.g. `just logs backend`)
[group('app')]
logs *services:
    docker compose logs -f {{ services }}

# Show container status
[group('app')]
ps:
    docker compose ps

# Restart one service (frontend, backend or postgres)
[group('app')]
restart service:
    docker compose restart {{ service }}

# Build and start the production image (port 5001 by default)
[group('app')]
prod-up:
    docker compose --profile prod up -d --build app
    @echo "Production build: http://localhost:${PROD_APP_PORT:-5001}"

# Stop the production image
[group('app')]
prod-down:
    docker compose --profile prod stop app


# Install frontend dependencies from package-lock.json
[group('frontend')]
fe-install:
    docker compose run --rm --no-deps frontend npm install --no-audit --no-fund

# Add npm packages (e.g. `just fe-add zod` or `just fe-add -D vitest`)
[group('frontend')]
fe-add +packages:
    docker compose run --rm --no-deps frontend npm install --no-audit --no-fund {{ packages }}

# Lint the frontend
[group('frontend')]
fe-lint:
    docker compose run --rm --no-deps frontend npm run lint

# Format the frontend with Prettier
[group('frontend')]
fe-format:
    docker compose run --rm --no-deps frontend npm run format

# Build the static export (output in frontend/out)
[group('frontend')]
fe-build:
    docker compose run --rm --no-deps frontend npm run build

# Open a shell in the frontend container
[group('frontend')]
fe-shell:
    docker compose run --rm --no-deps frontend sh


# Build the backend
[group('backend')]
be-build:
    docker compose run --rm --no-deps backend dotnet build

# Open a shell in the backend container
[group('backend')]
be-shell:
    docker compose run --rm --no-deps backend bash

# Add an EF Core migration (e.g. `just migration-add AddRounds`)
[group('backend')]
migration-add name:
    docker compose run --rm --no-deps backend sh -c "dotnet tool restore && dotnet restore && dotnet ef migrations add {{ name }} --project src/WheelOfArtemis.Api --output-dir Data/Migrations"


# Apply pending migrations without starting the app (the app also applies them on startup)
[group('database')]
db-update:
    docker compose run --rm backend sh -c "dotnet tool restore && dotnet restore && dotnet ef database update --project src/WheelOfArtemis.Api"

# Delete all data and start with an empty, migrated database
[group('database')]
db-reset:
    docker compose rm --stop --force backend postgres
    docker volume rm --force wheel-of-artemis_pgdata
    docker compose up -d

# Open psql in the Postgres container
[group('database')]
psql:
    docker compose exec postgres psql -U "${POSTGRES_USER:-artemis}" -d "${POSTGRES_DB:-wheel_of_artemis}"
