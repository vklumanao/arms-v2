# ARMS v3 New Machine Setup (Dockerized Dev)

This guide sets up the full dev stack on a new machine:

- Frontend (Vite)
- Backend (Node/Express)
- CKAN stack (`ckan-docker`)
- ARMS database (`arms-db`)

## 1) Prerequisites

- Install Docker Desktop
- Install Git

## 2) Clone repository

```bash
git clone <your-repo-url>
cd arms-v3
```

## 3) Prepare environment files

No manual copy/paste needed for first run.

`scripts/bootstrap-dev.ps1` will:

- create `backend/.env` from `backend/.env.example` when missing
- create `ckan-docker/.env` from `ckan-docker/.env.example` when missing
- auto-generate `ARMS_JWT_SECRET` and `ARMS_ENCRYPTION_KEY` if placeholders are present
- create CKAN service/admin bootstrap users
- generate `CKAN_API_KEY` and write it to `backend/.env`
- create one ARMS admin account once

## 4) Bootstrap and start the full stack

```powershell
.\scripts\bootstrap-dev.ps1
```

## 5) Access services

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:4010/api`
- CKAN (HTTPS): `https://127.0.0.1:9443` (or your configured SSL port)

## 6) Stop services

From `ckan-docker/`:

```bash
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml down
```

Remove volumes too (optional):

```bash
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml down -v
```

## 7) Real-time code updates (Docker dev)

Frontend and backend are configured for live development.

- Frontend (`vite`): runs with file polling for reliable hot reload on Docker Desktop + Windows.
- Backend (`node --watch`): restarts automatically when files under `backend/src` change.

Frontend polling config is already set in:

- `ckan-docker/docker-compose.arms.dev.yml`
  - `CHOKIDAR_USEPOLLING: "true"`
  - `CHOKIDAR_INTERVAL: "300"`
- `frontend/vite.config.js`
  - `server.watch.usePolling: true`
  - `server.watch.interval: 300`

If you change watcher config, recreate only the frontend container:

```bash
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml up -d --build frontend
```

Use this URL for frontend live reload:

- `http://127.0.0.1:5173`

## Notes

- `backend/.env` is loaded automatically by `backend` service via compose `env_file`.
- Backend database for Docker runs in `arms-db` and is separate from CKAN DB.
- Re-run bootstrap with token rotation:

```powershell
.\scripts\bootstrap-dev.ps1 -RotateToken
```
