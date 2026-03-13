# ARMS v3 New Machine Setup (Dockerized Dev)

This procedure starts the full local dev stack:

- Frontend (`frontend`)
- Backend (`backend`)
- CKAN stack (`ckan-docker`)
- ARMS Postgres database (`arms-db`)

## 1) Prerequisites

- Install Docker Desktop in Linux containers mode
- Enable hardware virtualization in BIOS/UEFI
- Enable Windows features: `WSL2` and `Virtual Machine Platform`
- Install Git

## 2) Clone the repository

```bash
git clone <your-repo-url>
cd arms-v2
```

## 3) Review the env files used by Docker

For the Docker dev flow, these are the only env files that must exist:

- `backend/.env`
- `ckan-docker/.env`

You do not need to create them manually on first run. The bootstrap script creates them from their matching `.env.example` files when missing.

`frontend/.env` is not required for the Docker setup because the frontend container gets its main Vite variables from `ckan-docker/docker-compose.arms.dev.yml`.

## 4) Run the bootstrap script

From the repo root:

```powershell
.\scripts\bootstrap-dev.ps1
```

This script will:

- create `backend/.env` from `backend/.env.example` when missing
- create `ckan-docker/.env` from `ckan-docker/.env.example` when missing
- generate `ARMS_JWT_SECRET` and `ARMS_ENCRYPTION_KEY` if placeholders are still present
- start the Docker Compose stack
- wait for `ckan` and `backend` to become ready
- create the CKAN service user and CKAN bootstrap admin user when needed
- generate `CKAN_API_KEY` and write it to `backend/.env`
- create the ARMS bootstrap admin account once
- keep password reset token debug exposure disabled by default
- recreate the backend container so the latest env values are applied

## 5) Wait for the first startup to finish

Expected behavior on first run:

- first bootstrap can take around 5 to 15 minutes depending on image downloads and caches
- CKAN can take a few minutes to report healthy after `db`, `solr`, and `redis` are up
- warnings from CKAN about `pkg_resources` can be ignored in local dev

## 6) Open the services

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:4010/api`
- CKAN: `https://127.0.0.1:8443`

The frontend now uses an `HttpOnly` session cookie for auth in the Docker dev setup. It no longer depends on a JWT stored in browser `localStorage`.

## 7) Connect to the databases from Beekeeper or another SQL client

ARMS database:

- Host: `127.0.0.1`
- Port: `5433`
- Database: `arms_v3`
- User: `arms_user`
- Password: `arms_password`
- SSL: `disable`

CKAN database:

- Host: `127.0.0.1`
- Port: `5434`
- Database: `ckandb`
- User: `ckandbuser`
- Password: `ckandbpassword`
- SSL: `disable`

CKAN admin connection:

- Host: `127.0.0.1`
- Port: `5434`
- Database: `postgres`
- User: `postgres`
- Password: `postgres`
- SSL: `disable`

Both databases are bound to `127.0.0.1` only, so they are reachable from your machine but not exposed to the local network by default.

## 8) Stop the stack

From the repo root:

```bash
docker compose -f ckan-docker/docker-compose.yml -f ckan-docker/docker-compose.arms.dev.yml down
```

If you want a full reset that also deletes Docker volumes:

```bash
docker compose -f ckan-docker/docker-compose.yml -f ckan-docker/docker-compose.arms.dev.yml down -v
```

`down -v` removes persisted Docker data, including the Postgres volumes. Use it only when you want a fresh local state.

## 9) Re-run bootstrap when needed

Rotate the CKAN token and write a fresh `CKAN_API_KEY` to `backend/.env`:

```powershell
.\scripts\bootstrap-dev.ps1 -RotateToken
```

If you edit `backend/.env` while containers are running, recreate the backend container:

```bash
docker compose -f ckan-docker/docker-compose.yml -f ckan-docker/docker-compose.arms.dev.yml up -d --force-recreate backend
```

If you need reset tokens returned directly by the API for local debugging, explicitly set `ARMS_EXPOSE_RESET_TOKEN_IN_RESPONSE=true` in `backend/.env`. Keep it `false` for normal development and any shared environment.

If you change frontend watcher settings, recreate the frontend container:

```bash
docker compose -f ckan-docker/docker-compose.yml -f ckan-docker/docker-compose.arms.dev.yml up -d --build frontend
```

## 10) Live reload behavior

- Frontend uses Vite with polling enabled for reliable file watching on Docker Desktop + Windows
- Backend restarts automatically in dev when watched files change

## 11) LAN access on the same Wi-Fi

If you want to open ARMS from another device on the same network, bind the frontend to `0.0.0.0` and point the frontend API base URL plus backend `CORS_ORIGINS` to your current IPv4 host.

Current LAN example:

- Frontend: `http://192.168.196.235:5173`
- Backend API: `http://192.168.196.235:4010/api`

After changing `ckan-docker/docker-compose.arms.dev.yml`, recreate the affected containers:

```bash
docker compose -f ckan-docker/docker-compose.yml -f ckan-docker/docker-compose.arms.dev.yml up -d --force-recreate backend frontend
```

If another device still cannot connect, allow ports `5173` and `4010` through the host firewall.

## Troubleshooting

- Docker Desktop reports virtualization missing:
  enable virtualization in BIOS/UEFI and confirm `WSL2` and `Virtual Machine Platform` are enabled
- `CKAN_API_KEY` stays `CHANGE_ME` or token generation fails:
  check `ckan-docker/.env` for placeholder values, fix them, then run `.\scripts\bootstrap-dev.ps1` again
- Beekeeper cannot connect to CKAN DB:
  verify that `POSTGRES_PORT_HOST=5434` is present in `ckan-docker/.env`
- Forgot-password does not return a reset token:
  this is now disabled by default; enable `ARMS_EXPOSE_RESET_TOKEN_IN_RESPONSE=true` only for explicit local debugging
