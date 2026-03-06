# Frontend Feature Structure

Use this rule first: `src/features/<feature>/<type>/<file>`.

## Folder conventions

- `pages/`: route-level screens
- `components/`: reusable UI inside the feature
- `services/`: API/data access and server calls
- `utils/`: feature helper functions
- `hooks/`: feature-specific hooks
- `config/`: constants and static configuration
- `index.js`: public exports for the feature

## Current route page locations

- `core/pages`: non-domain route pages (`HomePage`, `AboutPage`, `UnauthorizedPage`, `NotFoundPage`)
- `auth/pages`: auth screens
- `dashboard/pages`: dashboard screens
- `public-records/pages`: public record screens
- `submissions/pages`: submissions screens
- `admin/pages`: admin screens
