# ARMS Backend (CKAN-integrated)

## 1) Setup

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Update `.env` with your real DB and CKAN values:

- `DATABASE_URL` (example: `postgresql://arms_user:password@localhost:5432/arms-v2`)
- `DB_SSL` (`true` for managed DBs that require SSL)
- `CORS_ORIGINS` (comma-separated frontend origins, eg `http://localhost:5174`)
- `CKAN_BASE_URL` (example: `https://localhost:8443`)
- `CKAN_API_KEY` (sysadmin API key)
- `ARMS_JWT_SECRET` (strong random secret)
- `ARMS_ENCRYPTION_KEY` (64-char hex key for encrypting CKAN API tokens at rest)

## 2) Frontend setup

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Ensure these are set:

- `VITE_API_BASE_URL=http://localhost:4000/api`
- `VITE_UI_PREVIEW_MODE=false`

## 3) Implemented API routes

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

## 4) Registration behavior

On register, backend will:

1. Validate input.
2. Create CKAN user from submitted credentials.
3. Add user as `editor` to selected CKAN organization.
4. Add user as `editor` to selected CKAN group (department).
5. Store ARMS user profile linked to CKAN IDs.

## 5) Login behavior

On login, backend will:

1. Validate ARMS email/password.
2. Generate a CKAN API token via `api_token_create` for the linked CKAN user.
3. Save latest CKAN token server-side and return ARMS auth payload.

## Notes

- Persistence now uses PostgreSQL (`users` table) via `DATABASE_URL`.
- On first run, backend will auto-create the `users` table and import legacy records from `backend/data/users.json` if the table is empty.
- Keep `.env` out of git; only commit `.env.example`.
- Backend now includes: request validation (`zod`), rate-limiting on auth endpoints, audit logs, and reset-password token storage.
