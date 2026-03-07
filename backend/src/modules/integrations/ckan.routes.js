export function registerCkanIntegrationRoutes(app, deps) {
  const {
    authMiddleware,
    listOrganizations,
    listGroups,
    listOrganizationMembers,
    listUsers,
    listDatasets,
    listOrganizationAgendas,
  } = deps;

  app.get("/api/integrations/ckan/organizations", async (req, res) => {
    try {
      const rows = await listOrganizations();
      return res.json({ data: rows });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load organizations."),
      });
    }
  });

  app.get("/api/integrations/ckan/groups", async (req, res) => {
    try {
      const rows = await listGroups();
      return res.json({ data: rows });
    } catch (error) {
      return res
        .status(500)
        .json({ error: String(error?.message || "Failed to load groups.") });
    }
  });

  app.get("/api/integrations/ckan/users", authMiddleware, async (req, res) => {
    try {
      const orgId = String(req.query?.org_id || "").trim();
      const rows = orgId
        ? await listOrganizationMembers(orgId)
        : await listUsers();
      return res.json({
        data: (rows || [])
          .filter(
            (row) => String(row?.state || "active").toLowerCase() !== "deleted",
          )
          .map((row) => ({
            id: row?.id || null,
            name:
              row?.fullname ||
              row?.display_name ||
              row?.name ||
              row?.email ||
              "CKAN User",
            username: row?.name || null,
            email: row?.email || null,
            state: row?.state || "active",
            capacity: row?.capacity || null,
          })),
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load CKAN users."),
      });
    }
  });

  app.get("/api/integrations/ckan/datasets", async (req, res) => {
    try {
      const orgId = String(req.query?.org_id || "").trim();
      const q = String(req.query?.q || "").trim();
      const page = Number(req.query?.page || 1);
      const limit = Number(req.query?.limit || 20);
      const result = await listDatasets({ orgId, q, page, limit });
      return res.json({
        data: result.datasets,
        total: result.count,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load datasets."),
      });
    }
  });

  app.get(
    "/api/integrations/ckan/organizations/:orgId/agendas",
    async (req, res) => {
      try {
        const rows = await listOrganizationAgendas(req.params.orgId);
        return res.json({ data: rows });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to load organization agendas.",
          ),
        });
      }
    },
  );
}
