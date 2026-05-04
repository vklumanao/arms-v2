/**
 * Registers reference-data routes used by forms and admin selectors.
 *
 * System flow:
 * - Fetches organizations, groups, and optionally org-specific agendas.
 * - Normalizes these sources into stable `{ id, name }` arrays expected by frontend.
 */
export function registerReferenceRoutes(app, deps) {
  const {
    authMiddleware,
    listOrganizations,
    listGroups,
    listOrganizationAgendas,
  } = deps;

  app.get("/api/reference-data", authMiddleware, async (req, res) => {
    try {
      const orgId = String(req.query?.org_id || "").trim();
      const [centers, groups, agendas] = await Promise.all([
        listOrganizations(),
        listGroups(),
        // Agenda lookup is scoped to selected organization in CKAN.
        orgId ? listOrganizationAgendas(orgId) : Promise.resolve([]),
      ]);

      return res.json({
        // Research centers map from CKAN organizations.
        centers: centers.map((row) => ({
          id: row.name || row.id,
          name: row.title || row.display_name || row.name,
        })),
        // Agendas map from organization extras-derived values.
        agendas: agendas.map((row) => ({
          id: row.id || row.name,
          name: row.title || row.name,
        })),
        // Departments map from CKAN groups.
        departments: groups.map((row) => ({
          id: row.name || row.id,
          name: row.title || row.display_name || row.name,
        })),
        // Reserved for future proponent directory source.
        proponents: [],
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load reference data."),
      });
    }
  });
}
