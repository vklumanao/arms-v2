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
    listOrganizations,
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

  function isDatasetOwnedByUser(dataset, user) {
    const meta = extrasToMap(dataset?.extras);
    const submittedByUserId = asTrimmedString(meta.submitted_by_user_id);
    const submittedByEmail = asTrimmedString(
      meta.submitted_by_email,
    ).toLowerCase();
    const submittedBy = asTrimmedString(meta.submitted_by);
    const userId = asTrimmedString(user?.id);
    const userEmail = asTrimmedString(user?.email).toLowerCase();

    if (submittedByUserId && userId && submittedByUserId === userId)
      return true;
    if (submittedByEmail && userEmail && submittedByEmail === userEmail)
      return true;
    if (submittedBy && userId && submittedBy === userId) return true;
    if (
      asTrimmedString(dataset?.author_email).toLowerCase() === userEmail &&
      userEmail
    ) {
      return true;
    }
    return false;
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

  function normalizeCenterId(value, knownCenterIds) {
    const raw = asTrimmedString(value);
    if (!raw) return "__unassigned__";
    if (raw === "__unassigned__") return "__unassigned__";
    if (knownCenterIds && knownCenterIds.has(raw)) return raw;

    const lowered = raw.toLowerCase();
    if (
      lowered === "0" ||
      lowered === "null" ||
      lowered === "undefined" ||
      lowered === "none" ||
      lowered === "n/a"
    ) {
      return "__unassigned__";
    }

    return raw;
  }

  function resolveYearFromRecord(record) {
    const directYear = asTrimmedString(record?.year || record?.year_received);
    if (directYear && /^\d{4}$/.test(directYear)) return directYear;

    const candidates = [
      record?.submitted_at,
      record?.created_at,
      record?.updated_at,
      record?.start_date,
      record?.end_date,
    ];

    for (const raw of candidates) {
      const value = asTrimmedString(raw);
      if (!value) continue;
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
    }

    return "";
  }

  function isAwardDataset(dataset) {
    const meta = extrasToMap(dataset?.extras);
    return asTrimmedString(meta.record_type).toLowerCase() === "award";
  }

  function isMoaResource(resource = {}) {
    const name = asTrimmedString(resource?.name);
    const description = asTrimmedString(resource?.description);
    const notes = asTrimmedString(resource?.notes);
    return [name, description, notes].some((value) => /\bmoa\b/i.test(value));
  }

  function parseSelectedUsers(rawValue) {
    try {
      const parsed = JSON.parse(asTrimmedString(rawValue) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => ({
          id: asTrimmedString(row?.id),
          username: asTrimmedString(row?.username),
          email: asTrimmedString(row?.email).toLowerCase(),
        }))
        .filter((row) => row.id || row.username || row.email);
    } catch {
      return [];
    }
  }

  function parseExpectedOutputMetadata(rawValue) {
    try {
      const parsed = JSON.parse(asTrimmedString(rawValue) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => ({
          output_type: asTrimmedString(row?.output_type || row?.outputType),
          target_count: Math.max(
            1,
            Number(row?.target_count || row?.targetCount || 1) || 1,
          ),
        }))
        .filter((row) => row.output_type);
    } catch {
      return [];
    }
  }

  function isDatasetLinkedToUser(dataset, user) {
    if (!dataset || !user) return false;
    const meta = extrasToMap(dataset?.extras);

    const candidateIds = new Set(
      [user?.ckan_user_id, user?.id].map((value) => asTrimmedString(value)).filter(Boolean),
    );
    const candidateEmails = new Set(
      [user?.email]
        .map((value) => asTrimmedString(value).toLowerCase())
        .filter(Boolean),
    );
    const candidateUsername = asTrimmedString(user?.ckan_username).toLowerCase();

    const matchSelected = (row) => {
      const id = asTrimmedString(row?.id);
      const email = asTrimmedString(row?.email).toLowerCase();
      const username = asTrimmedString(row?.username).toLowerCase();
      if (id && candidateIds.has(id)) return true;
      if (email && candidateEmails.has(email)) return true;
      if (candidateUsername && username && username === candidateUsername) return true;
      return false;
    };

    const lead = parseSelectedUsers(meta.lead_researcher_user)[0] || null;
    if (lead && matchSelected(lead)) return true;

    const faculty = parseSelectedUsers(meta.faculty_team_users);
    if (faculty.some(matchSelected)) return true;

    return false;
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function buildLast12MonthsSeries() {
    const today = new Date();
    const map = new Map();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = monthKey(d);
      map.set(key, {
        key,
        month: d.toLocaleDateString(undefined, { month: "short" }),
        outputs: 0,
      });
    }
    return map;
  }

  async function loadDashboardLookups({ orgId = "" } = {}) {
    const [organizations, groups, agendas] = await Promise.all([
      listOrganizations(),
      listGroups(),
      orgId ? listOrganizationAgendas(orgId) : Promise.resolve([]),
    ]);

    const knownCenterIds = new Set(
      (organizations || [])
        .map((row) => asTrimmedString(row?.name || row?.id))
        .filter(Boolean),
    );
    const centerNameById = (organizations || []).reduce((acc, row) => {
      const id = asTrimmedString(row?.name || row?.id);
      if (!id) return acc;
      acc[id] =
        asTrimmedString(row?.title || row?.display_name || row?.name) || id;
      return acc;
    }, {});

    const departmentNameById = (groups || []).reduce((acc, row) => {
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

    return {
      knownCenterIds,
      centerNameById,
      departmentNameById,
      agendaNameById,
    };
  }

  async function listVisibleDatasetsForUser(user) {
    const isAdmin = String(user?.role || "").toLowerCase() === "admin";
    const orgId = isAdmin ? "" : asTrimmedString(user?.ckan_org_id);
    if (!isAdmin && !orgId) return { orgId: "", datasets: [] };
    const datasets = await listAllDatasetsForDashboard({ orgId });
    const visibleDatasets = (datasets || []).filter((dataset) =>
      isAdmin ? true : isDatasetOwnedByUser(dataset, user),
    );
    return { orgId, datasets: visibleDatasets };
  }

  function extractDatasetScopeIds(dataset, knownCenterIds) {
    const meta = extrasToMap(dataset?.extras);
    const centerId = normalizeCenterId(
      asTrimmedString(meta.research_center_id) ||
        asTrimmedString(dataset?.organization?.name) ||
        asTrimmedString(dataset?.owner_org),
      knownCenterIds,
    );

    const groups = Array.isArray(dataset?.groups) ? dataset.groups : [];
    const departmentId =
      asTrimmedString(meta.department_id) ||
      asTrimmedString(groups[0]?.name || groups[0]?.id) ||
      "";

    return { centerId, departmentId };
  }

  function matchesFilters(scope, filters) {
    const selectedCenterId = asTrimmedString(filters?.centerId);
    const selectedDepartmentId = asTrimmedString(filters?.departmentId);
    const selectedYear = asTrimmedString(filters?.year);

    if (
      selectedCenterId &&
      asTrimmedString(scope?.centerId) !== selectedCenterId
    ) {
      return false;
    }
    if (
      selectedDepartmentId &&
      asTrimmedString(scope?.departmentId) !== selectedDepartmentId
    ) {
      return false;
    }
    if (selectedYear && resolveYearFromRecord(scope) !== selectedYear) {
      return false;
    }
    return true;
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
        .filter((dataset) =>
          isAdmin ? true : isDatasetOwnedByUser(dataset, req.user),
        )
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

  app.get("/api/dashboard/filters/years", authMiddleware, async (req, res) => {
    try {
      const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
      void orgId;
      const years = new Set();

      (datasets || []).forEach((dataset) => {
        const meta = extrasToMap(dataset?.extras);
        const submittedAt =
          asTrimmedString(meta.submitted_at) ||
          asTrimmedString(dataset?.metadata_created);

        years.add(
          resolveYearFromRecord({
            year: meta.project_year,
            submitted_at: submittedAt,
            updated_at: dataset?.metadata_modified,
          }),
        );

        if (isAwardDataset(dataset)) {
          years.add(
            resolveYearFromRecord({
              year_received: meta.year_received,
              created_at: meta.submitted_at || dataset?.metadata_created,
              updated_at: dataset?.metadata_modified,
            }),
          );
          return;
        }

        const resources = Array.isArray(dataset?.resources)
          ? dataset.resources
          : [];
        resources.forEach((resource) => {
          if (isMoaResource(resource)) return;
          years.add(
            resolveYearFromRecord({
              created_at: resource?.created || dataset?.metadata_created,
              updated_at: resource?.last_modified || dataset?.metadata_modified,
            }),
          );
        });

        const expectedMetaRows = parseExpectedOutputMetadata(
          meta.expected_outputs_meta,
        );
        if (expectedMetaRows.length) {
          years.add(
            resolveYearFromRecord({
              updated_at: dataset?.metadata_modified || submittedAt,
            }),
          );
          return;
        }

        if (asTrimmedString(meta.expected_outputs_summary)) {
          years.add(
            resolveYearFromRecord({
              updated_at: dataset?.metadata_modified || submittedAt,
            }),
          );
        }
      });

      const sorted = [...years]
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a));
      return res.json({ data: sorted });
    } catch (error) {
      return res.status(500).json({
        error: String(
          error?.message || "Failed to load dashboard year options.",
        ),
      });
    }
  });

  app.get("/api/dashboard/overview", authMiddleware, async (req, res) => {
    try {
      const filters = {
        centerId: asTrimmedString(req.query?.centerId),
        departmentId: asTrimmedString(req.query?.departmentId),
        year: asTrimmedString(req.query?.year),
      };

      const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
      const {
        knownCenterIds,
        departmentNameById,
      } = await loadDashboardLookups({ orgId });
      const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
      const hasActiveFilters = Boolean(
        asTrimmedString(filters.centerId) ||
          asTrimmedString(filters.departmentId) ||
          asTrimmedString(filters.year),
      );

      let linkedProjectsCount = 0;
      if (!isAdmin && orgId) {
        const allOrgDatasets = await listAllDatasetsForDashboard({ orgId });
        const linkedSet = new Set();
        (allOrgDatasets || []).forEach((dataset) => {
          if (!dataset || isAwardDataset(dataset)) return;
          if (!isDatasetLinkedToUser(dataset, req.user)) return;
          const id = asTrimmedString(dataset?.id || dataset?.name);
          if (!id) return;
          linkedSet.add(id);
        });
        linkedProjectsCount = linkedSet.size;
      }

      const centerIdsInScope = new Set();
      const departmentIdsInScope = new Set();
      const affiliateIdsInScope = new Set();

      let projectsCount = 0;
      let outputsSubmittedCount = 0;
      let outputsExpectedCount = 0;
      let awardsCount = 0;

      (datasets || []).forEach((dataset) => {
        const meta = extrasToMap(dataset?.extras);
        const { centerId, departmentId } = extractDatasetScopeIds(
          dataset,
          knownCenterIds,
        );
        const submittedAt =
          asTrimmedString(meta.submitted_at) ||
          asTrimmedString(dataset?.metadata_created);
        const baseScope = {
          centerId,
          departmentId,
          year: asTrimmedString(meta.project_year),
          submitted_at: submittedAt,
          updated_at:
            asTrimmedString(dataset?.metadata_modified) ||
            asTrimmedString(dataset?.metadata_created),
          start_date: meta.start_date,
          end_date: meta.end_date,
        };

        if (isAwardDataset(dataset)) {
          const awardScope = {
            ...baseScope,
            year_received: asTrimmedString(meta.year_received),
          };
          if (!matchesFilters(awardScope, filters)) return;
          if (centerId) centerIdsInScope.add(centerId);
          if (departmentId) departmentIdsInScope.add(departmentId);
          awardsCount += 1;
          return;
        }

        if (!matchesFilters(baseScope, filters)) return;
        if (centerId) centerIdsInScope.add(centerId);
        if (departmentId) departmentIdsInScope.add(departmentId);
        projectsCount += 1;

        const leadUser =
          parseSelectedUsers(meta.lead_researcher_user)[0] || null;
        const facultyUsers = parseSelectedUsers(meta.faculty_team_users);
        const submittedById = asTrimmedString(
          meta.submitted_by_user_id || meta.submitted_by,
        );
        if (submittedById) affiliateIdsInScope.add(submittedById);
        if (leadUser?.id) affiliateIdsInScope.add(leadUser.id);
        facultyUsers.forEach((row) => {
          if (row?.id) affiliateIdsInScope.add(row.id);
        });

        const resources = Array.isArray(dataset?.resources)
          ? dataset.resources
          : [];
        resources.forEach((resource) => {
          if (isMoaResource(resource)) return;
          const outputScope = {
            centerId,
            departmentId,
            created_at: resource?.created || dataset?.metadata_created,
            updated_at: resource?.last_modified || dataset?.metadata_modified,
          };
          if (!matchesFilters(outputScope, filters)) return;
          outputsSubmittedCount += 1;
        });

        const expectedMetaRows = parseExpectedOutputMetadata(
          meta.expected_outputs_meta,
        );
        const expectedTimestamp =
          dataset?.metadata_modified ||
          dataset?.metadata_created ||
          submittedAt;
        if (expectedMetaRows.length) {
          expectedMetaRows.forEach(() => {
            const expectedScope = {
              centerId,
              departmentId,
              updated_at: expectedTimestamp,
            };
            if (!matchesFilters(expectedScope, filters)) return;
            outputsExpectedCount += 1;
          });
          return;
        }

        const summary = asTrimmedString(meta.expected_outputs_summary);
        if (!summary) return;
        summary
          .split(",")
          .map((chunk) => chunk.trim())
          .filter(Boolean)
          .forEach(() => {
            const expectedScope = {
              centerId,
              departmentId,
              updated_at: expectedTimestamp,
            };
            if (!matchesFilters(expectedScope, filters)) return;
            outputsExpectedCount += 1;
          });
      });

      const outputsCount = outputsSubmittedCount || outputsExpectedCount || 0;

      return res.json({
        data: {
          centers: hasActiveFilters
            ? centerIdsInScope.size
            : isAdmin
              ? knownCenterIds.size
              : centerIdsInScope.size,
          departments: hasActiveFilters
            ? departmentIdsInScope.size
            : isAdmin
              ? Object.keys(departmentNameById).length
              : departmentIdsInScope.size,
          affiliates: affiliateIdsInScope.size || 1,
          linkedProjects: linkedProjectsCount,
          projects: projectsCount,
          outputs: outputsCount,
          outputsSubmitted: outputsSubmittedCount,
          outputsExpected: outputsExpectedCount,
          awards: awardsCount,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load dashboard overview."),
      });
    }
  });

  app.get(
    "/api/dashboard/center-breakdown",
    authMiddleware,
    async (req, res) => {
      try {
        const filters = {
          centerId: asTrimmedString(req.query?.centerId),
          departmentId: asTrimmedString(req.query?.departmentId),
          year: asTrimmedString(req.query?.year),
        };

        const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
        const { knownCenterIds, centerNameById } = await loadDashboardLookups({
          orgId,
        });
        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";

        const projectCountByCenter = new Map();
        const outputCountByCenter = new Map();
        const awardCountByCenter = new Map();
        const affiliateIdsByCenter = new Map();

        (datasets || []).forEach((dataset) => {
          const meta = extrasToMap(dataset?.extras);
          const { centerId, departmentId } = extractDatasetScopeIds(
            dataset,
            knownCenterIds,
          );
          const submittedAt =
            asTrimmedString(meta.submitted_at) ||
            asTrimmedString(dataset?.metadata_created);
          const baseScope = {
            centerId,
            departmentId,
            year: asTrimmedString(meta.project_year),
            submitted_at: submittedAt,
            updated_at:
              asTrimmedString(dataset?.metadata_modified) ||
              asTrimmedString(dataset?.metadata_created),
          };

          if (isAwardDataset(dataset)) {
            const awardScope = {
              ...baseScope,
              year_received: asTrimmedString(meta.year_received),
            };
            if (!matchesFilters(awardScope, filters)) return;
            awardCountByCenter.set(
              centerId,
              (awardCountByCenter.get(centerId) || 0) + 1,
            );
            return;
          }

          if (!matchesFilters(baseScope, filters)) return;
          projectCountByCenter.set(
            centerId,
            (projectCountByCenter.get(centerId) || 0) + 1,
          );

          if (!affiliateIdsByCenter.has(centerId)) {
            affiliateIdsByCenter.set(centerId, new Set());
          }
          const affiliateSet = affiliateIdsByCenter.get(centerId);
          const leadUser =
            parseSelectedUsers(meta.lead_researcher_user)[0] || null;
          const facultyUsers = parseSelectedUsers(meta.faculty_team_users);
          const submittedById = asTrimmedString(
            meta.submitted_by_user_id || meta.submitted_by,
          );
          if (submittedById) affiliateSet.add(submittedById);
          if (leadUser?.id) affiliateSet.add(leadUser.id);
          facultyUsers.forEach((row) => {
            if (row?.id) affiliateSet.add(row.id);
          });

          const resources = Array.isArray(dataset?.resources)
            ? dataset.resources
            : [];
          resources.forEach((resource) => {
            if (isMoaResource(resource)) return;
            const outputScope = {
              centerId,
              departmentId,
              created_at: resource?.created || dataset?.metadata_created,
              updated_at: resource?.last_modified || dataset?.metadata_modified,
            };
            if (!matchesFilters(outputScope, filters)) return;
            outputCountByCenter.set(
              centerId,
              (outputCountByCenter.get(centerId) || 0) + 1,
            );
          });
        });

        const activityCenterIds = new Set([
          ...projectCountByCenter.keys(),
          ...outputCountByCenter.keys(),
          ...awardCountByCenter.keys(),
          ...affiliateIdsByCenter.keys(),
        ]);

        const selectedCenterId = normalizeCenterId(
          filters.centerId,
          knownCenterIds,
        );
        const baseCenterIds = (() => {
          if (asTrimmedString(filters.centerId)) {
            return selectedCenterId ? [selectedCenterId] : [];
          }
          if (isAdmin) {
            return [...knownCenterIds];
          }
          const userCenterId = normalizeCenterId(
            req.user?.ckan_org_id,
            knownCenterIds,
          );
          return userCenterId ? [userCenterId] : [];
        })();

        const centerIds = new Set(baseCenterIds);
        if (activityCenterIds.has("__unassigned__")) {
          centerIds.add("__unassigned__");
        }

        const resolveCenterName = (centerId) => {
          if (centerId === "__unassigned__") return "Unassigned";
          return asTrimmedString(centerNameById[centerId]) || "Unknown";
        };

        const rows = [...centerIds]
          .map((centerId) => ({
            id: centerId,
            name: resolveCenterName(centerId),
            projects: projectCountByCenter.get(centerId) || 0,
            affiliates: affiliateIdsByCenter.has(centerId)
              ? affiliateIdsByCenter.get(centerId).size || 1
              : null,
            outputs: outputCountByCenter.get(centerId) || 0,
            awards: awardCountByCenter.get(centerId) || 0,
          }))
          .sort((a, b) => b.projects - a.projects || b.outputs - a.outputs);

        return res.json({ data: rows });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load center breakdown."),
        });
      }
    },
  );

  app.get(
    "/api/dashboard/charts/projects-per-center",
    authMiddleware,
    async (req, res) => {
      try {
        const filters = {
          centerId: asTrimmedString(req.query?.centerId),
          departmentId: asTrimmedString(req.query?.departmentId),
          year: asTrimmedString(req.query?.year),
        };

        const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
        const { knownCenterIds, centerNameById } = await loadDashboardLookups({
          orgId,
        });

        const counts = new Map();
        (datasets || []).forEach((dataset) => {
          if (isAwardDataset(dataset)) return;
          const meta = extrasToMap(dataset?.extras);
          const { centerId, departmentId } = extractDatasetScopeIds(
            dataset,
            knownCenterIds,
          );
          const submittedAt =
            asTrimmedString(meta.submitted_at) ||
            asTrimmedString(dataset?.metadata_created);
          const scope = {
            centerId,
            departmentId,
            year: asTrimmedString(meta.project_year),
            submitted_at: submittedAt,
            updated_at:
              asTrimmedString(dataset?.metadata_modified) ||
              asTrimmedString(dataset?.metadata_created),
          };
          if (!matchesFilters(scope, filters)) return;

          const label =
            centerId === "__unassigned__"
              ? "Unassigned"
              : asTrimmedString(centerNameById[centerId]) || "Unknown";
          counts.set(label, (counts.get(label) || 0) + 1);
        });

        const rows = [...counts.entries()]
          .map(([center, count]) => ({ center, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        return res.json({ data: rows });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to load projects per center chart.",
          ),
        });
      }
    },
  );

  app.get(
    "/api/dashboard/charts/outputs-by-department",
    authMiddleware,
    async (req, res) => {
      try {
        const filters = {
          centerId: asTrimmedString(req.query?.centerId),
          departmentId: asTrimmedString(req.query?.departmentId),
          year: asTrimmedString(req.query?.year),
        };

        const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
        const { knownCenterIds, departmentNameById } =
          await loadDashboardLookups({
            orgId,
          });

        const counts = new Map();
        (datasets || []).forEach((dataset) => {
          if (isAwardDataset(dataset)) return;
          const meta = extrasToMap(dataset?.extras);
          const { centerId, departmentId } = extractDatasetScopeIds(
            dataset,
            knownCenterIds,
          );
          const resources = Array.isArray(dataset?.resources)
            ? dataset.resources
            : [];
          resources.forEach((resource) => {
            if (isMoaResource(resource)) return;
            const scope = {
              centerId,
              departmentId,
              created_at: resource?.created || dataset?.metadata_created,
              updated_at: resource?.last_modified || dataset?.metadata_modified,
            };
            if (!matchesFilters(scope, filters)) return;

            const label =
              asTrimmedString(departmentNameById[departmentId]) ||
              asTrimmedString(meta.program_department) ||
              "Unassigned";
            counts.set(label, (counts.get(label) || 0) + 1);
          });
        });

        const rows = [...counts.entries()]
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);

        return res.json({ data: rows });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to load outputs by department chart.",
          ),
        });
      }
    },
  );

  app.get(
    "/api/dashboard/charts/outputs-over-time",
    authMiddleware,
    async (req, res) => {
      try {
        const filters = {
          centerId: asTrimmedString(req.query?.centerId),
          departmentId: asTrimmedString(req.query?.departmentId),
          year: asTrimmedString(req.query?.year),
        };

        const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
        const { knownCenterIds } = await loadDashboardLookups({ orgId });

        const monthMap = buildLast12MonthsSeries();
        const bump = (rawTimestamp, incrementBy = 1) => {
          const value = asTrimmedString(rawTimestamp);
          if (!value) return;
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) return;
          const key = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
          if (!monthMap.has(key)) return;
          monthMap.get(key).outputs += incrementBy;
        };

        let submittedCount = 0;
        (datasets || []).forEach((dataset) => {
          if (isAwardDataset(dataset)) return;
          const { centerId, departmentId } = extractDatasetScopeIds(
            dataset,
            knownCenterIds,
          );
          const resources = Array.isArray(dataset?.resources)
            ? dataset.resources
            : [];
          resources.forEach((resource) => {
            if (isMoaResource(resource)) return;
            const scope = {
              centerId,
              departmentId,
              created_at: resource?.created || dataset?.metadata_created,
              updated_at: resource?.last_modified || dataset?.metadata_modified,
            };
            if (!matchesFilters(scope, filters)) return;
            submittedCount += 1;
            bump(
              resource?.created ||
                resource?.last_modified ||
                dataset?.metadata_modified,
              1,
            );
          });
        });

        if (submittedCount === 0) {
          (datasets || []).forEach((dataset) => {
            if (isAwardDataset(dataset)) return;
            const meta = extrasToMap(dataset?.extras);
            const { centerId, departmentId } = extractDatasetScopeIds(
              dataset,
              knownCenterIds,
            );
            const timestamp =
              dataset?.metadata_modified ||
              dataset?.metadata_created ||
              meta.submitted_at;
            const expectedMetaRows = parseExpectedOutputMetadata(
              meta.expected_outputs_meta,
            );

            if (expectedMetaRows.length) {
              expectedMetaRows.forEach(() => {
                const scope = { centerId, departmentId, updated_at: timestamp };
                if (!matchesFilters(scope, filters)) return;
                bump(timestamp, 1);
              });
              return;
            }

            const summary = asTrimmedString(meta.expected_outputs_summary);
            if (!summary) return;
            summary
              .split(",")
              .map((chunk) => chunk.trim())
              .filter(Boolean)
              .forEach(() => {
                const scope = { centerId, departmentId, updated_at: timestamp };
                if (!matchesFilters(scope, filters)) return;
                bump(timestamp, 1);
              });
          });
        }

        return res.json({ data: Array.from(monthMap.values()) });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to load outputs over time chart.",
          ),
        });
      }
    },
  );

  app.get(
    "/api/dashboard/charts/awards-by-category",
    authMiddleware,
    async (req, res) => {
      try {
        const filters = {
          centerId: asTrimmedString(req.query?.centerId),
          departmentId: asTrimmedString(req.query?.departmentId),
          year: asTrimmedString(req.query?.year),
        };

        const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
        const { knownCenterIds } = await loadDashboardLookups({ orgId });

        const counts = new Map();
        (datasets || []).forEach((dataset) => {
          if (!isAwardDataset(dataset)) return;
          const meta = extrasToMap(dataset?.extras);
          const { centerId, departmentId } = extractDatasetScopeIds(
            dataset,
            knownCenterIds,
          );
          const scope = {
            centerId,
            departmentId,
            year_received: asTrimmedString(meta.year_received),
            created_at: meta.submitted_at || dataset?.metadata_created,
            updated_at: dataset?.metadata_modified || dataset?.metadata_created,
          };
          if (!matchesFilters(scope, filters)) return;
          const category = asTrimmedString(meta.level) || "Unspecified";
          counts.set(category, (counts.get(category) || 0) + 1);
        });

        const rows = [...counts.entries()]
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);

        return res.json({ data: rows });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to load awards by category chart.",
          ),
        });
      }
    },
  );

  app.get(
    "/api/dashboard/recent/projects",
    authMiddleware,
    async (req, res) => {
      try {
        const limit = Math.max(1, Math.min(20, Number(req.query?.limit || 6)));
        const filters = {
          centerId: asTrimmedString(req.query?.centerId),
          departmentId: asTrimmedString(req.query?.departmentId),
          year: asTrimmedString(req.query?.year),
        };

        const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
        const {
          agendaNameById,
          centerNameById,
          departmentNameById,
          knownCenterIds,
        } = await loadDashboardLookups({ orgId });

        const rows = (datasets || [])
          .filter((dataset) => !isAwardDataset(dataset))
          .map((dataset) => {
            const project = toDashboardProjectRow(dataset, {
              groupNameById: departmentNameById,
              agendaNameById,
            });
            const { centerId, departmentId } = extractDatasetScopeIds(
              dataset,
              knownCenterIds,
            );

            return {
              ...project,
              research_center_id: centerId,
              research_center_name:
                asTrimmedString(centerNameById[centerId]) ||
                asTrimmedString(dataset?.organization?.title) ||
                asTrimmedString(dataset?.organization?.name) ||
                null,
              department_id: departmentId || project.department_id,
              department_name:
                asTrimmedString(departmentNameById[departmentId]) ||
                project.department_name ||
                null,
            };
          })
          .filter((project) => {
            const scope = {
              centerId: normalizeCenterId(
                project?.research_center_id,
                knownCenterIds,
              ),
              departmentId: asTrimmedString(project?.department_id),
              year: asTrimmedString(project?.year),
              updated_at: project?.updated_at,
              submitted_at: project?.submitted_at,
            };
            return matchesFilters(scope, filters);
          })
          .sort(
            (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
          )
          .slice(0, limit);

        return res.json({ data: rows });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load recent projects."),
        });
      }
    },
  );

  app.get("/api/dashboard/recent/outputs", authMiddleware, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(20, Number(req.query?.limit || 6)));
      const filters = {
        centerId: asTrimmedString(req.query?.centerId),
        departmentId: asTrimmedString(req.query?.departmentId),
        year: asTrimmedString(req.query?.year),
      };

      const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
      const { knownCenterIds } = await loadDashboardLookups({ orgId });

      const submitted = [];
      (datasets || []).forEach((dataset) => {
        if (isAwardDataset(dataset)) return;
        const { centerId, departmentId } = extractDatasetScopeIds(
          dataset,
          knownCenterIds,
        );
        const resources = Array.isArray(dataset?.resources)
          ? dataset.resources
          : [];
        resources.forEach((resource) => {
          if (isMoaResource(resource)) return;
          const row = {
            id: resource?.id || `${dataset?.id || dataset?.name}-resource`,
            file_name: resource?.name || null,
            output_type: asTrimmedString(resource?.format) || "resource",
            created_at: resource?.created || dataset?.metadata_created || null,
            updated_at:
              resource?.last_modified || dataset?.metadata_modified || null,
            centerId,
            departmentId,
          };
          const scope = {
            centerId,
            departmentId,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
          if (!matchesFilters(scope, filters)) return;
          submitted.push(row);
        });
      });

      if (submitted.length) {
        submitted.sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at || 0) -
            new Date(a.updated_at || a.created_at || 0),
        );
        return res.json({
          data: { mode: "submitted", rows: submitted.slice(0, limit) },
        });
      }

      const expectedByProject = new Map();
      (datasets || []).forEach((dataset) => {
        if (isAwardDataset(dataset)) return;
        const meta = extrasToMap(dataset?.extras);
        const { centerId, departmentId } = extractDatasetScopeIds(
          dataset,
          knownCenterIds,
        );
        const timestamp =
          dataset?.metadata_modified ||
          dataset?.metadata_created ||
          meta.submitted_at;
        const scope = { centerId, departmentId, updated_at: timestamp };
        if (!matchesFilters(scope, filters)) return;

        const projectId = asTrimmedString(dataset?.id || dataset?.name);
        if (!projectId) return;
        if (!expectedByProject.has(projectId)) {
          expectedByProject.set(projectId, {
            projectId,
            projectTitle:
              asTrimmedString(dataset?.title || dataset?.name) ||
              "Project outputs updated",
            timestamp,
            labels: new Set(),
          });
        }
        const entry = expectedByProject.get(projectId);
        entry.timestamp = entry.timestamp || timestamp;

        const expectedMetaRows = parseExpectedOutputMetadata(
          meta.expected_outputs_meta,
        );
        if (expectedMetaRows.length) {
          expectedMetaRows.forEach((row) => entry.labels.add(row.output_type));
          return;
        }

        const summary = asTrimmedString(meta.expected_outputs_summary);
        if (!summary) return;
        summary
          .split(",")
          .map((chunk) => chunk.trim())
          .filter(Boolean)
          .forEach((label) => entry.labels.add(label));
      });

      const expectedRows = [...expectedByProject.values()]
        .map((row) => ({
          projectId: row.projectId,
          projectTitle: row.projectTitle,
          timestamp: row.timestamp,
          labels: [...row.labels].slice(0, 3),
        }))
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, limit);

      return res.json({ data: { mode: "expected", rows: expectedRows } });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load recent outputs."),
      });
    }
  });

  app.get("/api/dashboard/recent/awards", authMiddleware, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(20, Number(req.query?.limit || 6)));
      const filters = {
        centerId: asTrimmedString(req.query?.centerId),
        departmentId: asTrimmedString(req.query?.departmentId),
        year: asTrimmedString(req.query?.year),
      };

      const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
      const { knownCenterIds } = await loadDashboardLookups({ orgId });

      const rows = (datasets || [])
        .filter((dataset) => isAwardDataset(dataset))
        .map((dataset) => {
          const meta = extrasToMap(dataset?.extras);
          const { centerId, departmentId } = extractDatasetScopeIds(
            dataset,
            knownCenterIds,
          );
          return {
            id: dataset?.id || dataset?.name || null,
            award_recognition:
              asTrimmedString(meta.award_recognition) ||
              asTrimmedString(dataset?.title) ||
              "Award / Recognition",
            recipients: asTrimmedString(meta.recipients),
            level: asTrimmedString(meta.level),
            year_received: asTrimmedString(meta.year_received),
            research_center_id: centerId,
            department_id: departmentId,
            created_at:
              asTrimmedString(meta.submitted_at) ||
              asTrimmedString(dataset?.metadata_created) ||
              null,
            updated_at:
              asTrimmedString(dataset?.metadata_modified) ||
              asTrimmedString(dataset?.metadata_created) ||
              null,
          };
        })
        .filter((award) => {
          const scope = {
            centerId: award.research_center_id,
            departmentId: award.department_id,
            year_received: award.year_received,
            created_at: award.created_at,
            updated_at: award.updated_at,
          };
          return matchesFilters(scope, filters);
        })
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at || 0) -
            new Date(a.updated_at || a.created_at || 0),
        )
        .slice(0, limit);

      return res.json({ data: rows });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load recent awards."),
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
