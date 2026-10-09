# One Dockerfile for the whole app. docker-compose picks a stage per service:
#   frontend-dev / backend-dev  -> local development with hot reload (source is bind-mounted)
#   runtime                     -> production image: .NET serves the API and the static Next.js export

ARG NODE_VERSION=24
ARG DOTNET_VERSION=10.0

# ---------- Frontend ----------

FROM node:${NODE_VERSION}-alpine AS frontend-dev
# Dev containers run as the host user (see docker-compose.yaml), so give them a writable home for caches.
RUN mkdir -p /home/dev && chmod 777 /home/dev
ENV HOME=/home/dev \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/frontend
EXPOSE 3000
CMD ["sh", "-c", "npm install --no-audit --no-fund && exec npm run dev -- --hostname 0.0.0.0"]

FROM node:${NODE_VERSION}-alpine AS frontend-build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- Backend ----------

FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS backend-dev
RUN mkdir -p /home/dev/.nuget/packages && chmod -R 777 /home/dev
# ArtifactsPath moves build output outside the bind-mounted source, so it never clashes with the host IDE's bin/obj.
ENV HOME=/home/dev \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    DOTNET_WATCH_RESTART_ON_RUDE_EDIT=1 \
    DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER=1 \
    ArtifactsPath=/home/dev/artifacts
WORKDIR /app/backend
EXPOSE 8080
CMD ["dotnet", "watch", "--project", "src/WheelOfArtemis.Api", "run", "--no-launch-profile"]

FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS backend-build
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1
WORKDIR /src/backend
# Restore first, so the package layer is cached until a project file changes.
COPY backend/global.json backend/Directory.Build.props backend/Directory.Packages.props backend/WheelOfArtemis.slnx ./
COPY backend/src/WheelOfArtemis.Api/WheelOfArtemis.Api.csproj src/WheelOfArtemis.Api/
RUN dotnet restore src/WheelOfArtemis.Api/WheelOfArtemis.Api.csproj
COPY backend/ ./
RUN dotnet publish src/WheelOfArtemis.Api/WheelOfArtemis.Api.csproj -c Release -o /out --no-restore

# ---------- Production ----------

FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS runtime
WORKDIR /app
COPY --from=backend-build /out ./
COPY --from=frontend-build /src/frontend/out ./wwwroot
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "WheelOfArtemis.Api.dll"]
