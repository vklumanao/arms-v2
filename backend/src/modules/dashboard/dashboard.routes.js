import crypto from "node:crypto";
import { query } from "../../db/client.js";

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

  function parseDateValue(value) {
    const raw = asTrimmedString(value);
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function getCandidateDates(record) {
    const dates = [
      record?.submitted_at,
      record?.created_at,
      record?.updated_at,
      record?.start_date,
      record?.end_date,
    ]
      .map(parseDateValue)
      .filter(Boolean);

    const yearValue = asTrimmedString(record?.year || record?.year_received);
    if (yearValue && /^\d{4}$/.test(yearValue)) {
      const yearDate = parseDateValue(`${yearValue}-01-01`);
      if (yearDate) dates.push(yearDate);
    }

    return dates;
  }

  function matchesRange(scope, range) {
    const normalized = asTrimmedString(range).toLowerCase();
    if (!normalized) return true;
    const dates = getCandidateDates(scope);
    if (!dates.length) return false;

    const now = new Date();
    if (normalized === "last12") {
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return dates.some((date) => date >= start && date <= now);
    }

    if (normalized === "thisyear") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return dates.some((date) => date >= start && date < end);
    }

    return true;
  }

  function parseFundingAmount(value) {
    const numeric = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function normalizeFundingBucket({
    funding_type: fundingType,
    funding_category: fundingCategory,
    funding_source: fundingSource,
  }) {
    const raw = [fundingType, fundingCategory, fundingSource]
      .map((value) => asTrimmedString(value).toLowerCase())
      .filter(Boolean)
      .join(" ");

    if (!raw) return "unknown";
    if (
      raw.includes("internal") ||
      raw.includes("university") ||
      raw.includes("school") ||
      raw.includes("campus") ||
      raw.includes("institution") ||
      raw.includes("self")
    ) {
      return "internal";
    }
    if (
      raw.includes("external") ||
      raw.includes("industry") ||
      raw.includes("private") ||
      raw.includes("government") ||
      raw.includes("grant")
    ) {
      return "external";
    }
    return "unknown";
  }

  function normalizeAwardLevel(value) {
    const raw = asTrimmedString(value).toLowerCase();
    if (!raw) return "Other";
    if (raw.includes("institutional")) return "Institutional";
    if (raw.includes("local")) return "Local";
    if (raw.includes("university")) return "Institutional";
    if (raw.includes("regional")) return "Regional";
    if (raw.includes("international")) return "International";
    if (raw.includes("national")) return "National";
    return "Other";
  }

  function parseContributorNames(raw) {
    const text = asTrimmedString(raw);
    if (!text) return [];
    return text
      .split(/[,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function buildContributorEntries(meta) {
    const entries = [];
    const seen = new Set();

    const selectedUsers = [
      ...parseSelectedUsers(meta?.lead_researcher_user),
      ...parseSelectedUsers(meta?.faculty_team_users),
    ];

    selectedUsers.forEach((row) => {
      const key = resolveAffiliateKey(row);
      if (!key || seen.has(key)) return;
      seen.add(key);
      entries.push({
        key,
        label:
          asTrimmedString(row?.username) ||
          asTrimmedString(row?.email) ||
          asTrimmedString(row?.id),
      });
    });

    parseContributorNames(meta?.lead_researcher).forEach((name) => {
      const key = name.toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      entries.push({ key, label: name });
    });

    parseContributorNames(meta?.faculty_team).forEach((name) => {
      const key = name.toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      entries.push({ key, label: name });
    });

    if (!entries.length) {
      const fallback =
        asTrimmedString(meta?.submitted_by_name) ||
        asTrimmedString(meta?.submitted_by_email) ||
        asTrimmedString(meta?.submitted_by);
      if (fallback) {
        entries.push({ key: fallback.toLowerCase(), label: fallback });
      }
    }

    return entries;
  }

  function buildProjectOwnerEntry(
    meta,
    { userNameById = new Map(), userNameByEmail = new Map() } = {},
  ) {
    const ownerId = asTrimmedString(meta?.submitted_by_user_id);
    if (ownerId) {
      const label = asTrimmedString(userNameById.get(ownerId)) || ownerId;
      return [{ key: ownerId, label }];
    }
    const ownerEmail = asTrimmedString(meta?.submitted_by_email).toLowerCase();
    if (ownerEmail) {
      const label =
        asTrimmedString(userNameByEmail.get(ownerEmail)) || ownerEmail;
      return [{ key: ownerEmail, label }];
    }
    const ownerName = asTrimmedString(meta?.submitted_by_name);
    if (ownerName) {
      return [{ key: ownerName.toLowerCase(), label: ownerName }];
    }
    const fallback = asTrimmedString(meta?.submitted_by);
    if (fallback) {
      return [{ key: fallback.toLowerCase(), label: fallback }];
    }
    return [];
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
    const normalizeRow = (row) => ({
      id: asTrimmedString(row?.id),
      username: asTrimmedString(row?.username),
      email: asTrimmedString(row?.email).toLowerCase(),
    });

    if (Array.isArray(rawValue)) {
      return rawValue
        .map(normalizeRow)
        .filter((row) => row.id || row.username || row.email);
    }

    if (rawValue && typeof rawValue === "object") {
      const row = normalizeRow(rawValue);
      return row.id || row.username || row.email ? [row] : [];
    }

    const rawString = asTrimmedString(rawValue);
    if (!rawString) return [];

    try {
      const parsed = JSON.parse(rawString);
      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizeRow)
          .filter((row) => row.id || row.username || row.email);
      }
      if (parsed && typeof parsed === "object") {
        const row = normalizeRow(parsed);
        return row.id || row.username || row.email ? [row] : [];
      }
      if (typeof parsed === "string") {
        const token = asTrimmedString(parsed);
        if (!token) return [];
        return [
          {
            id: token,
            username: token,
            email: token.includes("@") ? token.toLowerCase() : "",
          },
        ];
      }
      return [];
    } catch {
      return [
        {
          id: rawString,
          username: rawString,
          email: rawString.includes("@") ? rawString.toLowerCase() : "",
        },
      ];
    }
  }

  function resolveAffiliateKey(row) {
    if (!row) return "";
    return (
      asTrimmedString(row.id) ||
      asTrimmedString(row.username) ||
      asTrimmedString(row.email)
    );
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
      [user?.ckan_user_id, user?.id]
        .map((value) => asTrimmedString(value))
        .filter(Boolean),
    );
    const candidateEmails = new Set(
      [user?.email]
        .map((value) => asTrimmedString(value).toLowerCase())
        .filter(Boolean),
    );
    const candidateUsername = asTrimmedString(
      user?.ckan_username,
    ).toLowerCase();

    const matchSelected = (row) => {
      const id = asTrimmedString(row?.id);
      const email = asTrimmedString(row?.email).toLowerCase();
      const username = asTrimmedString(row?.username).toLowerCase();
      if (id && candidateIds.has(id)) return true;
      if (email && candidateEmails.has(email)) return true;
      if (candidateUsername && username && username === candidateUsername)
        return true;
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
    const selectedRange = asTrimmedString(filters?.range);

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
    if (selectedRange && !matchesRange(scope, selectedRange)) {
      return false;
    }
    return true;
  }

  const DASHBOARD_SUMMARY_CACHE = new Map();
  const DASHBOARD_SUMMARY_TTL_MS = 30 * 1000;

  function buildSummaryCacheKey(req, filters, limit) {
    const userId = asTrimmedString(req.user?.id);
    const userRole = asTrimmedString(req.user?.role);
    const orgId = asTrimmedString(req.user?.ckan_org_id);
    return [
      userId || "-",
      userRole || "-",
      orgId || "-",
      asTrimmedString(filters?.centerId) || "-",
      asTrimmedString(filters?.departmentId) || "-",
      asTrimmedString(filters?.year) || "-",
      asTrimmedString(filters?.range) || "-",
      String(limit || 0),
    ].join("|");
  }

  async function computeDashboardSummary({ req, filters, limit }) {
    const { orgId, datasets } = await listVisibleDatasetsForUser(req.user);
    const {
      knownCenterIds,
      centerNameById,
      departmentNameById,
      agendaNameById,
    } = await loadDashboardLookups({ orgId });
    const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
    const hasActiveFilters = Boolean(
      asTrimmedString(filters.centerId) ||
      asTrimmedString(filters.departmentId) ||
      asTrimmedString(filters.year) ||
      asTrimmedString(filters.range),
    );

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

    const yearOptions = [...years]
      .filter(Boolean)
      .sort((a, b) => Number(b) - Number(a));

    const affiliateCountsResult = await query(
      `
      SELECT COALESCE(ckan_org_id, '') AS center_id,
             COUNT(*)::int AS count
      FROM users
      WHERE is_active = TRUE
        AND role IN ('faculty', 'student')
      GROUP BY COALESCE(ckan_org_id, '')
      `,
    );
    const affiliateCountByCenter = new Map();
    let totalAffiliateCount = 0;
    (affiliateCountsResult.rows || []).forEach((row) => {
      const normalizedCenterId = normalizeCenterId(
        asTrimmedString(row?.center_id),
        knownCenterIds,
      );
      const count = Number(row?.count || 0);
      if (!normalizedCenterId) return;
      affiliateCountByCenter.set(
        normalizedCenterId,
        (affiliateCountByCenter.get(normalizedCenterId) || 0) + count,
      );
      totalAffiliateCount += count;
    });

    const userNameById = new Map();
    const userNameByEmail = new Map();
    const userLookupResult = await query(
      `
      SELECT id, full_name, email
      FROM users
      WHERE is_active = TRUE
      `,
    );
    (userLookupResult.rows || []).forEach((row) => {
      const id = asTrimmedString(row?.id);
      const email = asTrimmedString(row?.email).toLowerCase();
      const name =
        asTrimmedString(row?.full_name) || email || id || "ARMS User";
      if (id) userNameById.set(id, name);
      if (email) userNameByEmail.set(email, name);
    });

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

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isWithinCurrentMonth = (value) => {
      const raw = asTrimmedString(value);
      if (!raw) return false;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return false;
      return d >= monthStart && d <= now;
    };

    let projectsThisMonth = 0;
    let outputsThisMonth = 0;
    let awardsThisMonth = 0;

    const fundingOverview = {
      totalAmount: 0,
      totalProjects: 0,
      internalAmount: 0,
      internalProjects: 0,
      externalAmount: 0,
      externalProjects: 0,
      unknownAmount: 0,
      unknownProjects: 0,
    };

    const outputsVisibility = {
      public: 0,
      private: 0,
    };

    const awardsByLevelCounts = new Map();
    const contributorMonthCounts = new Map();
    const contributorYearCounts = new Map();
    const selectedYearRaw = asTrimmedString(filters.year);
    const selectedYearValue = /^\d{4}$/.test(selectedYearRaw)
      ? Number(selectedYearRaw)
      : now.getFullYear();
    const monthStartForContrib = new Date(selectedYearValue, now.getMonth(), 1);
    const monthEndForContrib = new Date(
      selectedYearValue,
      now.getMonth() + 1,
      1,
    );
    const last12Start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const yearStart = new Date(selectedYearValue, 0, 1);
    const yearEnd = new Date(selectedYearValue + 1, 0, 1);
    const rangeKey = asTrimmedString(filters.range).toLowerCase();
    const yearRangeStart = rangeKey === "last12" ? last12Start : yearStart;
    const yearRangeEnd = rangeKey === "last12" ? now : yearEnd;
    const monthLabel = monthStartForContrib.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const yearLabel =
      rangeKey === "last12" ? "Last 12 months" : selectedYearRaw || "This year";

    const inRange = (date, start, end) => date && date >= start && date < end;
    const addContributorCount = (map, entry) => {
      if (!entry?.key) return;
      const existing = map.get(entry.key) || {
        key: entry.key,
        name: entry.label || entry.key,
        projects: 0,
        total: 0,
      };
      existing.projects += 1;
      existing.total = existing.projects;
      map.set(entry.key, existing);
    };

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
        const level = normalizeAwardLevel(meta.level);
        awardsByLevelCounts.set(
          level,
          (awardsByLevelCounts.get(level) || 0) + 1,
        );
        const awardTimestamp =
          asTrimmedString(meta.submitted_at) ||
          asTrimmedString(dataset?.metadata_modified) ||
          asTrimmedString(dataset?.metadata_created);
        if (isWithinCurrentMonth(awardTimestamp)) {
          awardsThisMonth += 1;
        }
        const awardDate =
          parseDateValue(awardTimestamp) ||
          parseDateValue(
            asTrimmedString(meta.year_received)
              ? `${asTrimmedString(meta.year_received)}-01-01`
              : "",
          );
        return;
      }

      if (!matchesFilters(baseScope, filters)) return;
      if (centerId) centerIdsInScope.add(centerId);
      if (departmentId) departmentIdsInScope.add(departmentId);
      projectsCount += 1;
      const projectTimestamp =
        asTrimmedString(dataset?.metadata_modified) ||
        asTrimmedString(dataset?.metadata_created) ||
        submittedAt;
      if (isWithinCurrentMonth(projectTimestamp)) {
        projectsThisMonth += 1;
      }

      const projectContributors = buildProjectOwnerEntry(meta, {
        userNameById,
        userNameByEmail,
      });
      const projectDate =
        parseDateValue(projectTimestamp) || parseDateValue(submittedAt);
      if (projectDate && inRange(projectDate, yearRangeStart, yearRangeEnd)) {
        projectContributors.forEach((entry) =>
          addContributorCount(contributorYearCounts, entry),
        );
      }
      if (
        projectDate &&
        inRange(projectDate, monthStartForContrib, monthEndForContrib)
      ) {
        projectContributors.forEach((entry) =>
          addContributorCount(contributorMonthCounts, entry),
        );
      }

      const leadUser = parseSelectedUsers(meta.lead_researcher_user)[0] || null;
      const facultyUsers = parseSelectedUsers(meta.faculty_team_users);
      const submittedById = asTrimmedString(
        meta.submitted_by_user_id || meta.submitted_by,
      );
      if (submittedById) affiliateIdsInScope.add(submittedById);
      const leadKey = resolveAffiliateKey(leadUser);
      if (leadKey) affiliateIdsInScope.add(leadKey);
      facultyUsers.forEach((row) => {
        const key = resolveAffiliateKey(row);
        if (key) affiliateIdsInScope.add(key);
      });

      const fundingAmount = parseFundingAmount(meta.funding_amount);
      const fundingBucket = normalizeFundingBucket(meta);
      const hasFunding =
        fundingAmount > 0 ||
        Boolean(
          asTrimmedString(meta.funding_source) ||
          asTrimmedString(meta.funding_type) ||
          asTrimmedString(meta.funding_category),
        );
      if (hasFunding) {
        fundingOverview.totalProjects += 1;
        fundingOverview.totalAmount += fundingAmount;
        if (fundingBucket === "internal") {
          fundingOverview.internalProjects += 1;
          fundingOverview.internalAmount += fundingAmount;
        } else if (fundingBucket === "external") {
          fundingOverview.externalProjects += 1;
          fundingOverview.externalAmount += fundingAmount;
        } else {
          fundingOverview.unknownProjects += 1;
          fundingOverview.unknownAmount += fundingAmount;
        }
      }

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
        if (dataset?.private) {
          outputsVisibility.private += 1;
        } else {
          outputsVisibility.public += 1;
        }
        const outputTimestamp =
          asTrimmedString(resource?.last_modified) ||
          asTrimmedString(resource?.created) ||
          asTrimmedString(dataset?.metadata_modified) ||
          asTrimmedString(dataset?.metadata_created);
        if (isWithinCurrentMonth(outputTimestamp)) {
          outputsThisMonth += 1;
        }
        const outputDate = parseDateValue(outputTimestamp);
      });

      const expectedMetaRows = parseExpectedOutputMetadata(
        meta.expected_outputs_meta,
      );
      const expectedTimestamp =
        dataset?.metadata_modified || dataset?.metadata_created || submittedAt;
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
    const resolvedCenterId = asTrimmedString(filters.centerId)
      ? normalizeCenterId(filters.centerId, knownCenterIds)
      : normalizeCenterId(req.user?.ckan_org_id, knownCenterIds);

    const overview = {
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
      affiliates: isAdmin
        ? asTrimmedString(filters.centerId)
          ? affiliateCountByCenter.get(
              normalizeCenterId(filters.centerId, knownCenterIds),
            ) || 0
          : totalAffiliateCount
        : resolvedCenterId
          ? affiliateCountByCenter.get(resolvedCenterId) || 0
          : 0,
      linkedProjects: linkedProjectsCount,
      projects: projectsCount,
      outputs: outputsCount,
      outputsSubmitted: outputsSubmittedCount,
      outputsExpected: outputsExpectedCount,
      awards: awardsCount,
      activityThisMonth: {
        projects: projectsThisMonth,
        outputs: outputsThisMonth,
        awards: awardsThisMonth,
      },
    };

    if (
      asTrimmedString(req?.query?.debug_affiliates) === "1" ||
      asTrimmedString(req?.query?.debug_affiliates) === "true"
    ) {
      console.log("[dashboard] affiliates debug", {
        affiliatesCount: asTrimmedString(filters.centerId)
          ? affiliateCountByCenter.get(
              normalizeCenterId(filters.centerId, knownCenterIds),
            ) || 0
          : totalAffiliateCount,
        affiliatesMode: "active_users_by_center",
        affiliateIds: [...affiliateIdsInScope],
        filters,
      });
    }

    const projectCountByCenter = new Map();
    const outputCountByCenter = new Map();
    const awardCountByCenter = new Map();

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
      ...affiliateCountByCenter.keys(),
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

    const centerBreakdownRows = [...centerIds]
      .map((centerId) => ({
        id: centerId,
        name: resolveCenterName(centerId),
        projects: projectCountByCenter.get(centerId) || 0,
        affiliates: affiliateCountByCenter.get(centerId) || 0,
        outputs: outputCountByCenter.get(centerId) || 0,
        awards: awardCountByCenter.get(centerId) || 0,
      }))
      .sort((a, b) => b.projects - a.projects || b.outputs - a.outputs);

    const projectsPerCenterCounts = new Map();
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
      projectsPerCenterCounts.set(
        label,
        (projectsPerCenterCounts.get(label) || 0) + 1,
      );
    });

    const projectsPerCenterData = [...projectsPerCenterCounts.entries()]
      .map(([center, count]) => ({ center, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const outputsByDepartmentCounts = new Map();
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
        outputsByDepartmentCounts.set(
          label,
          (outputsByDepartmentCounts.get(label) || 0) + 1,
        );
      });
    });

    const outputsByDepartmentData = [...outputsByDepartmentCounts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

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

    const outputsOverTimeData = Array.from(monthMap.values());

    const awardsByCategoryCounts = new Map();
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
      awardsByCategoryCounts.set(
        category,
        (awardsByCategoryCounts.get(category) || 0) + 1,
      );
    });

    const awardsByCategoryData = [...awardsByCategoryCounts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const awardsLevelOrder = [
      "Institutional",
      "Local",
      "Regional",
      "National",
      "International",
      "Other",
    ];
    const awardsByLevelData = awardsLevelOrder.map((level) => ({
      level,
      value: awardsByLevelCounts.get(level) || 0,
    }));

    const topContributors = {
      month: {
        label: monthLabel,
        rows: [...contributorMonthCounts.values()]
          .sort((a, b) => b.total - a.total || b.outputs - a.outputs)
          .slice(0, 5),
      },
      year: {
        label: yearLabel,
        rows: [...contributorYearCounts.values()]
          .sort((a, b) => b.total - a.total || b.outputs - a.outputs)
          .slice(0, 5),
      },
    };

    const recentProjects = (datasets || [])
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
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
      .slice(0, limit);

    const submittedOutputs = [];
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
        submittedOutputs.push(row);
      });
    });

    let recentOutputs = { mode: "submitted", rows: [] };
    if (submittedOutputs.length) {
      submittedOutputs.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0) -
          new Date(a.updated_at || a.created_at || 0),
      );
      recentOutputs = {
        mode: "submitted",
        rows: submittedOutputs.slice(0, limit),
      };
    } else {
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

      recentOutputs = { mode: "expected", rows: expectedRows };
    }

    const recentAwards = (datasets || [])
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

    return {
      yearOptions,
      overview,
      centerBreakdownRows,
      projectsPerCenterData,
      outputsByDepartmentData,
      outputsOverTimeData,
      awardsByCategoryData,
      awardsByLevelData,
      fundingOverview,
      outputsVisibility: {
        ...outputsVisibility,
        total: outputsVisibility.public + outputsVisibility.private,
      },
      topContributors,
      recentProjects,
      recentOutputs,
      recentAwards,
    };
  }

  async function getDashboardSummary({ req, filters, limit }) {
    const cacheKey = buildSummaryCacheKey(req, filters, limit);
    const now = Date.now();
    const cached = DASHBOARD_SUMMARY_CACHE.get(cacheKey);
    if (cached && now - cached.ts < DASHBOARD_SUMMARY_TTL_MS) {
      return cached.data;
    }

    const data = await computeDashboardSummary({ req, filters, limit });
    DASHBOARD_SUMMARY_CACHE.set(cacheKey, { ts: now, data });
    return data;
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
      const filters = {
        centerId: asTrimmedString(req.query?.centerId),
        departmentId: asTrimmedString(req.query?.departmentId),
        year: asTrimmedString(req.query?.year),
        range: asTrimmedString(req.query?.range),
      };
      const data = await getDashboardSummary({ req, filters, limit: 6 });
      return res.json({ data: data.yearOptions });
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
        range: asTrimmedString(req.query?.range),
      };
      const data = await getDashboardSummary({ req, filters, limit: 6 });
      return res.json({ data: data.overview });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load dashboard overview."),
      });
    }
  });

  app.get("/api/dashboard/summary", authMiddleware, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(20, Number(req.query?.limit || 6)));
      const filters = {
        centerId: asTrimmedString(req.query?.centerId),
        departmentId: asTrimmedString(req.query?.departmentId),
        year: asTrimmedString(req.query?.year),
        range: asTrimmedString(req.query?.range),
      };
      const data = await getDashboardSummary({ req, filters, limit });
      return res.json({ data });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load dashboard summary."),
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
          range: asTrimmedString(req.query?.range),
        };
        const data = await getDashboardSummary({ req, filters, limit: 6 });
        return res.json({ data: data.centerBreakdownRows });
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
          range: asTrimmedString(req.query?.range),
        };
        const data = await getDashboardSummary({ req, filters, limit: 6 });
        return res.json({ data: data.projectsPerCenterData });
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
          range: asTrimmedString(req.query?.range),
        };
        const data = await getDashboardSummary({ req, filters, limit: 6 });
        return res.json({ data: data.outputsByDepartmentData });
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
          range: asTrimmedString(req.query?.range),
        };
        const data = await getDashboardSummary({ req, filters, limit: 6 });
        return res.json({ data: data.outputsOverTimeData });
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
          range: asTrimmedString(req.query?.range),
        };
        const data = await getDashboardSummary({ req, filters, limit: 6 });
        return res.json({ data: data.awardsByCategoryData });
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
          range: asTrimmedString(req.query?.range),
        };
        const data = await getDashboardSummary({ req, filters, limit });
        return res.json({ data: data.recentProjects });
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
        range: asTrimmedString(req.query?.range),
      };
      const data = await getDashboardSummary({ req, filters, limit });
      return res.json({ data: data.recentOutputs });
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
        range: asTrimmedString(req.query?.range),
      };
      const data = await getDashboardSummary({ req, filters, limit });
      return res.json({ data: data.recentAwards });
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
