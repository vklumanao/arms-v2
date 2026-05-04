/**
 * Registers CKAN integration passthrough/reference routes.
 *
 * System flow:
 * - Exposes organizations, groups, users, datasets, and org agendas.
 * - Normalizes output shapes for frontend consumption.
 */
export function registerCkanIntegrationRoutes(app, deps) {
  const {
    authMiddleware,
    listOrganizations,
    listGroups,
    listOrganizationMembers,
    listUsers,
    listDatasets,
    listOrganizationAgendas,
    findUserByEmail,
  } = deps;

  app.get("/api/integrations/ckan/organizations", async (req, res) => {
    try {
      // Publicly used as reference data in registration/admin screens.
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
      // Publicly used as reference data for department/group selectors.
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
      // Optionally scope to members of a specific organization.
      const rows = orgId
        ? await listOrganizationMembers(orgId)
        : await listUsers();
      const data = await Promise.all(
        (rows || [])
          // Hide deleted users from selector/list contexts.
          .filter(
            (row) => String(row?.state || "active").toLowerCase() !== "deleted",
          )
          .map(async (row) => {
            const email = String(row?.email || "")
              .trim()
              .toLowerCase();
            const armsUser = email ? await findUserByEmail(email) : null;
            return {
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
              role: armsUser?.role || null,
            };
          }),
      );
      return res.json({
        data,
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
      // Preserve pagination metadata for client-side table controls.
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
        // Agendas are derived from organization extras in CKAN.
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
