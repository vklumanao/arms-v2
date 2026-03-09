# ARMS Full Dev Stack (Frontend + Backend + CKAN)

This adds ARMS services on top of the existing `ckan-docker` stack so you can run everything together.

## 1) Prerequisites

- Docker Desktop running
- `ckan-docker/.env` exists (copy from `.env.example` if needed)

## 2) Configure backend secrets once

Set these values in `../backend/.env`:

- `CKAN_API_KEY=<your-ckan-sysadmin-api-key>`
- `ARMS_JWT_SECRET=<your-dev-jwt-secret>`
- `ARMS_ENCRYPTION_KEY=<64-char-hex-key>`

The backend service reads `../backend/.env` automatically via compose `env_file`.

## 3) Build and run the full stack

From `ckan-docker/` directory:

```powershell
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml up --build
```

## 4) URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api`
- CKAN (nginx): `https://localhost:8443`

## 5) Stop

```powershell
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml down
```

To also remove volumes:

```powershell
docker compose -f docker-compose.yml -f docker-compose.arms.dev.yml down -v
```

## Notes

- Backend uses `CKAN_BASE_URL=http://ckan:5000` inside Docker network.
- ARMS backend DB is separate (`arms-db`) from CKAN DB.
- Source folders are bind-mounted for dev live reload.
