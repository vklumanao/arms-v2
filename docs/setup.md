# ARMS v3 New Machine Setup (Dockerized Dev)

Straightforward steps to bring up the full local dev stack:

- Frontend (`frontend`)
- Backend (`backend`)
- CKAN stack (`ckan-docker`)
- ARMS Postgres DB (`arms-db`)

## 1) Prerequisites

- Docker Desktop (Linux containers mode)
- WSL2 + Virtual Machine Platform enabled
- Git

## 2) Clone the repo

```bash
git clone <your-repo-url>
cd arms-v3
```

## 3) Run the bootstrap script

From the repo root:

```powershell
.\scripts\bootstrap-dev.ps1
```

What this script does:

- creates `backend/.env` and `ckan-docker/.env` if missing (from `.env.example`)
- generates secrets if placeholders are still present
- checks Docker Desktop / Compose health and confirms Linux containers mode
- warms `frontend`, `backend`, and `ckan` images one by one before full startup
- starts the Docker Compose stack
- waits for `ckan` and `backend`
- creates CKAN service user + CKAN admin
- validates the saved `CKAN_API_KEY` against live CKAN and refreshes it automatically if stale
- writes `CKAN_API_KEY` into `backend/.env`
- creates ARMS bootstrap admin (one-time)
- recreates backend so new env values apply

## 4) Open the services

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4010/api`
- CKAN: `https://localhost:8443`

First boot can take 5 to 15 minutes (image downloads + CKAN warmup).

## 5) DB connection (local only)

ARMS DB:

- Host: `127.0.0.1`
- Port: `5433`
- Database: `arms_v3`
- User: `arms_user`
- Password: `arms_password`
- SSL: `disable`

CKAN DB:

- Host: `127.0.0.1`
- Port: `5434`
- Database: `ckandb`
- User: `ckandbuser`
- Password: `ckandbpassword`
- SSL: `disable`

## 6) Stop the stack

```bash
docker compose -f ckan-docker/docker-compose.yml -f ckan-docker/docker-compose.arms.dev.yml down
```

Full reset (delete volumes):

```bash
docker compose -f ckan-docker/docker-compose.yml -f ckan-docker/docker-compose.arms.dev.yml down -v
```

## 7) Re-run bootstrap (if needed)

Rotate CKAN API key and update `backend/.env`:

```powershell
.\scripts\bootstrap-dev.ps1 -RotateToken
```

If you edit `backend/.env`:

```bash
docker compose -f ckan-docker/docker-compose.yml -f ckan-docker/docker-compose.arms.dev.yml up -d --force-recreate backend
```

If you edit frontend watcher settings:

```bash
docker compose -f ckan-docker/docker-compose.yml -f ckan-docker/docker-compose.arms.dev.yml up -d --build frontend
```
