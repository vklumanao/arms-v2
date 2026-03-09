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

### Backend env

Create `backend/.env` (or copy from your working machine), then ensure these are set:

- `CKAN_API_KEY=<your-ckan-sysadmin-api-key>`
- `ARMS_JWT_SECRET=<your-secret>`
- `ARMS_ENCRYPTION_KEY=<64-char-hex-key>`

You can start from:

```bash
cp backend/.env.example backend/.env
```

### CKAN env

Create `ckan-docker/.env`:

```bash
cp ckan-docker/.env.example ckan-docker/.env
```

Update values as needed (ports, sysadmin defaults, etc.).

## 4) Start the full stack

```bash
cd ckan-docker
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml up --build
```

## 5) Access services

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`
- CKAN (HTTPS): `https://localhost:8443` (or your configured SSL port)

## 6) Stop services

```bash
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml down
```

Remove volumes too (optional):

```bash
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml down -v
```

## Notes

- `backend/.env` is loaded automatically by `backend` service via compose `env_file`.
- Backend database for Docker runs in `arms-db` and is separate from CKAN DB.
- If CKAN API auth fails, re-check `CKAN_API_KEY` in `backend/.env`, then restart backend:

```bash
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml restart backend
```
