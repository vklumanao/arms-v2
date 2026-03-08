import crypto from "node:crypto";

/**
 * Registers dashboard-related API routes.
 *
 * System flow:
 * - Builds normalized dashboard project rows from CKAN datasets.
 * - Restricts non-admin users to datasets scoped to their CKAN organization.
 * - Returns sorted project list for dashboard consumption.
 *
 * Dependencies:
 * - Receives auth and CKAN access functions through injected `deps`.
 */
export function registerDashboardRoutes(app, deps) {
  const {
    authMiddleware,
    asTrimmedString,
    listDatasets,
    listGroups,
    listOrganizationAgendas,
  } = deps;

  /**
   * Converts CKAN `extras` array into a case-insensitive key-value map.
   *
   * Data transformation:
   * - Normalizes keys to lowercase trimmed strings.
   * - Keeps last value encountered for duplicate keys.
   */
  function extrasToMap(extras) {
    const rows = Array.isArray(extras) ? extras : [];
    return rows.reduce((acc, item) => {
      const key = String(item?.key || "")
        .trim()
        .toLowerCase();
      if (!key) return acc;
      acc[key] = item?.value ?? null;
      return acc;
    }, {});
  }

  /**
   * Loads all datasets needed for dashboard views with bounded pagination.
   *
   * Edge case:
   * - Uses hard page cap to avoid infinite loops when upstream count metadata
   *   is inconsistent.
   */
  async function listAllDatasetsForDashboard({ orgId = "" } = {}) {
    const rows = [];
    const limit = 100;
    let page = 1;

    // Safety cap prevents runaway requests on malformed pagination metadata.
    while (page <= 20) {
      const result = await listDatasets({ orgId, page, limit });
      const datasets = Array.isArray(result?.datasets) ? result.datasets : [];
      rows.push(...datasets);

      const total = Number(result?.count || 0);
      if (!datasets.length || rows.length >= total || datasets.length < limit) {
        break;
      }
      page += 1;
    }

    return rows;
  }

  /**
   * Normalizes a CKAN dataset into dashboard project row shape.
   *
   * Important logic:
   * - Reconciles project metadata from both CKAN top-level fields and extras.
   * - Resolves human-readable department/agenda labels from lookup maps.
   * - Adds generated fallback id when CKAN id/name is unavailable.
   */
  function toDashboardProjectRow(
    dataset,
    { groupNameById = {}, agendaNameById = {} } = {},
  ) {
    const meta = extrasToMap(dataset?.extras);
    const researchCenterId =
      asTrimmedString(meta.research_center_id) ||
      asTrimmedString(dataset?.organization?.name) ||
      asTrimmedString(dataset?.owner_org) ||
      null;
    const departmentId = asTrimmedString(meta.department_id) || null;
    const agendaId =
      asTrimmedString(meta.research_agenda_id) ||
      asTrimmedString(meta.agenda_id) ||
      null;
    const submittedAt =
      asTrimmedString(meta.submitted_at) ||
      asTrimmedString(dataset?.metadata_created) ||
      null;
    const updatedAt =
      asTrimmedString(dataset?.metadata_modified) ||
      asTrimmedString(dataset?.metadata_created) ||
      null;
    const status =
      asTrimmedString(meta.project_status) ||
      asTrimmedString(meta.status) ||
      "proposal";

    return {
      id: dataset?.id || dataset?.name || crypto.randomUUID(),
      title:
        asTrimmedString(dataset?.title || dataset?.name) || "Untitled project",
      abstract: asTrimmedString(dataset?.notes) || null,
      status,
      year:
        asTrimmedString(meta.project_year) ||
        (submittedAt ? String(new Date(submittedAt).getFullYear()) : ""),
      classification: asTrimmedString(meta.classification) || null,
      research_center_id: researchCenterId,
      research_agenda_id: agendaId,
      agenda_id: agendaId,
      agenda_name: agendaId ? agendaNameById[agendaId] || agendaId : null,
      department_id: departmentId,
      department_name: departmentId
        ? groupNameById[departmentId] || departmentId
        : null,
      lead_researcher: asTrimmedString(meta.lead_researcher) || null,
      expected_outputs: asTrimmedString(meta.expected_outputs_summary) || null,
      start_date: asTrimmedString(meta.start_date) || null,
      end_date: asTrimmedString(meta.end_date) || null,
      submitted_by:
        asTrimmedString(meta.submitted_by_user_id) ||
        asTrimmedString(meta.submitted_by) ||
        null,
      submitted_at: submittedAt,
      created_at: asTrimmedString(dataset?.metadata_created) || null,
      updated_at: updatedAt,
      ckan_dataset_id: dataset?.id || null,
      ckan_dataset_name: dataset?.name || null,
      private: Boolean(dataset?.private),
    };
  }

  app.get("/api/dashboard/projects", authMiddleware, async (req, res) => {
    try {
      const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
      const orgId = isAdmin ? "" : asTrimmedString(req.user?.ckan_org_id);
      if (!isAdmin && !orgId) {
        // Non-admin users without org scope cannot have dashboard project visibility.
        return res.json({ data: [] });
      }

      const [datasets, groups, agendas] = await Promise.all([
        listAllDatasetsForDashboard({ orgId }),
        listGroups(),
        orgId ? listOrganizationAgendas(orgId) : Promise.resolve([]),
      ]);

      const groupNameById = (groups || []).reduce((acc, row) => {
        const id = asTrimmedString(row?.name || row?.id);
        if (!id) return acc;
        acc[id] =
          asTrimmedString(row?.title || row?.display_name || row?.name) || id;
        return acc;
      }, {});
      const agendaNameById = (agendas || []).reduce((acc, row) => {
        const id = asTrimmedString(row?.id || row?.name);
        if (!id) return acc;
        acc[id] = asTrimmedString(row?.name || row?.title || row?.id) || id;
        return acc;
      }, {});

      const rows = (datasets || [])
        .map((dataset) =>
          toDashboardProjectRow(dataset, { groupNameById, agendaNameById }),
        )
        // Show most recently updated projects first for dashboard relevance.
        .sort(
          (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
        );

      return res.json({ data: rows });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load dashboard projects."),
      });
    }
  });

  app.get("/api/dashboard/status-history", authMiddleware, async (req, res) => {
    // Endpoint placeholder kept for frontend contract; implementation pending.
    const projectIds = String(req.query?.projectIds || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    void projectIds;
    return res.json({ data: [] });
  });

  app.post(
    "/api/dashboard/notify-upcoming-deadlines",
    authMiddleware,
    async (req, res) => {
      // Endpoint placeholder kept for frontend contract; implementation pending.
      const days = Number(req.body?.days || 14);
      void days;
      return res.json({ data: 0 });
    },
  );
}
