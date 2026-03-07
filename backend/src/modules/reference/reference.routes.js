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
        orgId ? listOrganizationAgendas(orgId) : Promise.resolve([]),
      ]);

      return res.json({
        centers: centers.map((row) => ({
          id: row.name || row.id,
          name: row.title || row.display_name || row.name,
        })),
        agendas: agendas.map((row) => ({
          id: row.id || row.name,
          name: row.title || row.name,
        })),
        departments: groups.map((row) => ({
          id: row.name || row.id,
          name: row.title || row.display_name || row.name,
        })),
        proponents: [],
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load reference data."),
      });
    }
  });
}
