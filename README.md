# ARMS v3

ARMS v3 is a CKAN-integrated research management system for managing users, access control, research centers, departments, and research-related submissions such as projects, outputs, and awards.

This repository contains the full application workspace:

- `frontend/` for the ARMS web interface
- `backend/` for the API and auth layer
- `ckan-docker/` for the local CKAN stack and dependencies
- `docs/` for supporting project documentation
- `scripts/` for helper scripts and utilities

## Overview

ARMS is designed to support institutional research workflows with role-aware access and CKAN-backed organization data. The app includes:

- authentication and profile management
- role-based access control
- user management and access control administration
- department and research center management
- research project, output, and award submission workflows
- public and internal record views

## Tech Stack

- Frontend: React 19, Vite, React Router, Radix UI
- Backend: Node.js, Express, PostgreSQL, Zod
- Integration: CKAN API
- Local infrastructure: Docker Compose for CKAN, PostgreSQL, Solr, Redis, NGINX, and DataPusher

## Repository Structure

```text
arms-v3/
|- backend/
|- ckan-docker/
|- docs/
|- frontend/
|- scripts/
`- README.md
```

## Prerequisites

Install these before running the project locally:

- Node.js 20+ recommended
- npm
- Docker Desktop or Docker Engine with Docker Compose v2
- PostgreSQL access for the backend database

## Local Setup

### 1. Start the CKAN stack

If you need the local CKAN environment:

```powershell
cd ckan-docker
copy .env.example .env
docker compose build
docker compose up -d
```

Default CKAN URL from the included docs:

- `https://localhost:8443`

Important:

- Change default CKAN sysadmin credentials before using the stack beyond local development.

### 2. Configure and run the backend

```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```

The backend runs on:

- `http://localhost:4000`

### 3. Configure and run the frontend

Open a new terminal:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

The frontend usually runs on:

- `http://localhost:5173`

## Environment Variables

### Frontend

From [frontend/.env.example](c:/Users/vklum/Desktop/ARMS/arms-v3/frontend/.env.example):

- `VITE_API_BASE_URL=http://localhost:4000/api`
- `VITE_UI_PREVIEW_MODE=false`

### Backend

From [backend/.env.example](c:/Users/vklum/Desktop/ARMS/arms-v3/backend/.env.example), the important values are:

- `PORT`
- `CORS_ORIGINS`
- `DATABASE_URL`
- `DB_SSL`
- `ARMS_JWT_SECRET`
- `ARMS_ENCRYPTION_KEY`
- `ARMS_DEFAULT_ADMIN_EMAIL`
- `ARMS_DEFAULT_ADMIN_PASSWORD`
- `ARMS_BOOTSTRAP_ADMIN_EMAIL`
- `ARMS_BOOTSTRAP_ADMIN_PASSWORD`
- `ARMS_PUBLIC_APP_URL`
- `CKAN_BASE_URL`
- `CKAN_API_KEY`
- `CKAN_VERIFY_TLS`

Notes:

- `ARMS_ENCRYPTION_KEY` should be a 64-character hex value.
- `CKAN_BASE_URL` should match your local or deployed CKAN instance.
- `CORS_ORIGINS` should include the frontend origin you are using.

## Available Scripts

### Frontend

From [frontend/package.json](c:/Users/vklum/Desktop/ARMS/arms-v3/frontend/package.json):

- `npm run dev` starts the Vite dev server
- `npm run build` creates a production build
- `npm run lint` runs ESLint
- `npm run preview` serves the built app locally

### Backend

From [backend/package.json](c:/Users/vklum/Desktop/ARMS/arms-v3/backend/package.json):

- `npm run dev` starts the backend in watch mode
- `npm start` starts the backend normally
- `npm test` runs backend tests
- `npm run bootstrap:admin` bootstraps an admin account

## Core Backend Routes

Implemented routes documented in the backend README include:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/integrations/ckan/organizations`
- `GET /api/integrations/ckan/groups`
- `GET /api/integrations/ckan/organizations/:orgId/agendas`
- `GET /api/reference-data`
- `GET /api/permissions/role-map`

## Development Workflow

For a typical local session:

1. Start `ckan-docker` if your task depends on CKAN-backed data.
2. Start the backend.
3. Start the frontend.
4. Sign in with a configured account or bootstrap an admin if needed.
5. Make changes in the relevant app folder.

If you are working only on frontend layout or isolated UI logic, you may not always need the full CKAN stack, depending on the screen and available mock/fallback behavior.

## Roles and Admin Areas

The current app structure shows support for role-aware experiences such as:

- admin
- faculty
- student
- center chief

Admin areas in the frontend include:

- user management
- access control
- research center management
- department management
- affiliate-related administrative views

## Troubleshooting

### Frontend cannot reach the API

Check:

- `VITE_API_BASE_URL` in `frontend/.env`
- backend is running on port `4000`
- `CORS_ORIGINS` includes your frontend URL

### Login or session issues

Check:

- `ARMS_JWT_SECRET`
- `ARMS_AUTH_COOKIE_*` settings
- backend and frontend are using the expected local URLs

### CKAN-backed data is missing

Check:

- `CKAN_BASE_URL`
- `CKAN_API_KEY`
- CKAN containers are healthy
- TLS verification settings such as `CKAN_VERIFY_TLS`

### Database connection errors

Check:

- `DATABASE_URL`
- PostgreSQL is reachable
- `DB_SSL` matches your database requirements

## Related READMEs

For more focused setup details, see:

- [backend/README.md](c:/Users/vklum/Desktop/ARMS/arms-v3/backend/README.md)
- [frontend/README.md](c:/Users/vklum/Desktop/ARMS/arms-v3/frontend/README.md)
- [ckan-docker/README.md](c:/Users/vklum/Desktop/ARMS/arms-v3/ckan-docker/README.md)

## Notes

- The backend README includes CKAN-integrated registration and login behavior details.
- The included `frontend/README.md` is still the default Vite template and may be updated later to better reflect this project.
- There is currently no root-level monorepo script runner; frontend, backend, and CKAN services are started separately.
