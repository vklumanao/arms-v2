import crypto from "node:crypto";
import { query } from "../../db/client.js";

/**
 * Registers admin controls and reference-management routes.
 *
 * System flow:
 * - Exposes affiliate listing sourced from CKAN users/memberships.
 * - Exposes reference data/usage/link endpoints for admin controls.
 * - Supports create/update flows for research centers (CKAN organizations).
 *
 * Dependency pattern:
 * - Core CKAN operations are injected from integration client.
 */
export function registerAdminRoutes(app, deps) {
  const {
    authMiddleware,
    badRequest,
    listOrganizations,
    listGroups,
    listUsers,
    listOrganizationMembers,
    listGroupMembers,
    listOrganizationAgendas,
    listDatasets,
    createOrganization,
    createGroup,
    deleteGroup,
    deleteOrganization,
    removeUserFromGroup,
    removeUserFromOrganization,
    assignUserToOrganizationAdmin,
    getGroup,
    getOrganization,
    updateGroupMetadata,
    updateOrganizationMetadata,
    setOrganizationMemberRole,
  } = deps;

  /**
   * Reads organization extra value by case-insensitive key.
   */
  function getExtraValue(row, key) {
    const extras = Array.isArray(row?.extras) ? row.extras : [];
    const found = extras.find(
      (item) =>
        String(item?.key || "")
          .trim()
          .toLowerCase() ===
        String(key || "")
          .trim()
          .toLowerCase(),
    );
    return found?.value || null;
  }

  /**
   * Normalizes and deduplicates agenda names from request payload.
   */
  function normalizeAgendaNames(values) {
    const input = Array.isArray(values) ? values : [];
    const seen = new Set();
    return input
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  /**
   * Reads CKAN user extra value by case-insensitive key.
   */
  function getUserExtraValue(user, key) {
    const extras = Array.isArray(user?.extras) ? user.extras : [];
    const found = extras.find(
      (item) =>
        String(item?.key || "")
          .trim()
          .toLowerCase() ===
        String(key || "")
          .trim()
          .toLowerCase(),
    );
    return found?.value ?? null;
  }

  /**
   * Parses a permissive boolean-like value from user extras.
   */
  function toBool(value, fallback = false) {
    if (value == null) return fallback;
    const text = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(text)) return true;
    if (["false", "0", "no", "n"].includes(text)) return false;
    return fallback;
  }

  function asTrimmedString(value) {
    if (value == null) return "";
    return String(value).trim();
  }

  function getDatasetExtraByKey(extras, key) {
    const rows = Array.isArray(extras) ? extras : [];
    const match = rows.find(
      (item) =>
        String(item?.key || "")
          .trim()
          .toLowerCase() ===
        String(key || "")
          .trim()
          .toLowerCase(),
    );
    return match?.value ?? null;
  }

  function normalizeOutputType(value) {
    const base = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s*\(target:[^)]+\)\s*$/i, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!base) return "";
    if (["publication", "publications", "journal_article"].includes(base)) {
      return "publication";
    }
    if (["creative_work", "creative_works", "creative"].includes(base)) {
      return "creative_work";
    }
    if (["award", "awards", "recognition"].includes(base)) return "award";
    if (
      [
        "patent_ip",
        "patent",
        "ip",
        "intellectual_property",
        "patent_intellectual_property",
      ].includes(base)
    ) {
      return "patent_ip";
    }
    return base;
  }

  function inferOutputTypeFromResource(resource) {
    const fromName = normalizeOutputType(resource?.name || "");
    if (fromName) return fromName;
    const fromDescription = normalizeOutputType(resource?.description || "");
    if (fromDescription) return fromDescription;
    const fromFormat = normalizeOutputType(resource?.format || "");
    if (fromFormat) return fromFormat;
    return "";
  }

  function createZeroMetrics() {
    return {
      publication_count: 0,
      research_project_count: 0,
      creative_work_count: 0,
      awards_count: 0,
      ip_count: 0,
    };
  }

  function normalizeDepartmentCode(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function listAllDatasetsAcrossCkan() {
    const rows = [];
    const limit = 100;
    let page = 1;
    while (page <= 50) {
      const result = await listDatasets({ page, limit });
      const datasets = Array.isArray(result?.datasets) ? result.datasets : [];
      if (!datasets.length) break;
      rows.push(...datasets);
      const total = Number(result?.count || 0);
      if (datasets.length < limit || (total > 0 && page * limit >= total)) {
        break;
      }
      page += 1;
    }
    return rows;
  }

  function buildLiveMetricsByCkanUserId(ckanUsers, datasets) {
    const identityToUserId = new Map();
    const metricsByUserId = {};

    (ckanUsers || []).forEach((user) => {
      const userId = asTrimmedString(user?.id).toLowerCase();
      if (!userId) return;
      metricsByUserId[userId] = createZeroMetrics();
      identityToUserId.set(`id:${userId}`, userId);
      const email = asTrimmedString(user?.email).toLowerCase();
      const username = asTrimmedString(user?.name).toLowerCase();
      if (email) identityToUserId.set(`email:${email}`, userId);
      if (username) identityToUserId.set(`username:${username}`, userId);
    });

    (datasets || []).forEach((dataset) => {
      const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
      const identities = [
        `id:${asTrimmedString(dataset?.creator_user_id).toLowerCase()}`,
        `id:${asTrimmedString(
          getDatasetExtraByKey(extras, "submitted_by_user_id"),
        ).toLowerCase()}`,
        `email:${asTrimmedString(
          getDatasetExtraByKey(extras, "submitted_by_email"),
        ).toLowerCase()}`,
        `email:${asTrimmedString(dataset?.author_email).toLowerCase()}`,
        `username:${asTrimmedString(
          getDatasetExtraByKey(extras, "submitted_by_ckan_username"),
        ).toLowerCase()}`,
        `username:${asTrimmedString(
          getDatasetExtraByKey(extras, "submitted_by_username"),
        ).toLowerCase()}`,
      ].filter((key) => !key.endsWith(":"));

      const ownerUserId =
        identities
          .map((identity) => identityToUserId.get(identity))
          .find(Boolean) || null;

      if (!ownerUserId) return;
      const metrics = metricsByUserId[ownerUserId] || createZeroMetrics();
      metrics.research_project_count += 1;

      const resources = Array.isArray(dataset?.resources) ? dataset.resources : [];
      resources.forEach((resource) => {
        const outputType = inferOutputTypeFromResource(resource);
        if (outputType === "publication") metrics.publication_count += 1;
        if (outputType === "creative_work") metrics.creative_work_count += 1;
        if (outputType === "award") metrics.awards_count += 1;
        if (outputType === "patent_ip") metrics.ip_count += 1;
      });

      metricsByUserId[ownerUserId] = metrics;
    });

    return metricsByUserId;
  }

  /**
   * Converts extras array into lowercase-key map.
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

  app.get("/api/admin/affiliates", authMiddleware, async (req, res) => {
    try {
      // Build affiliate rows from CKAN users enriched with org/group membership lookups.
      // Keep this endpoint available even when one CKAN read path is flaky.
      const [centersResult, groupsResult, usersResult, datasetsResult] =
        await Promise.allSettled([
          listOrganizations(),
          listGroups(),
          listUsers(),
          listAllDatasetsAcrossCkan(),
        ]);
      const centers =
        centersResult.status === "fulfilled" ? centersResult.value : [];
      const groups =
        groupsResult.status === "fulfilled" ? groupsResult.value : [];
      const ckanUsers =
        usersResult.status === "fulfilled" ? usersResult.value : [];
      const allDatasets =
        datasetsResult.status === "fulfilled" ? datasetsResult.value : [];
      const liveMetricsByCkanUserId = buildLiveMetricsByCkanUserId(
        ckanUsers,
        allDatasets,
      );

      const userOrgMap = {};
      const userDepartmentMap = {};
      await Promise.all(
        (centers || []).map(async (center) => {
          const orgId = center?.name || center?.id;
          if (!orgId) return;
          try {
            const members = await listOrganizationMembers(orgId);
            (members || []).forEach((member) => {
              const memberId = String(member?.id || "").trim();
              if (memberId && !userOrgMap[memberId]) {
                userOrgMap[memberId] = orgId;
              }
            });
          } catch {
            // Skip organizations that cannot be read; continue best-effort enrichment.
            // Best-effort only.
          }
        }),
      );

      await Promise.all(
        (groups || []).map(async (group) => {
          const groupId = group?.name || group?.id;
          if (!groupId) return;
          const groupLabel = String(
            group?.title || group?.display_name || group?.name || "",
          ).trim();
          if (!groupLabel) return;
          try {
            const members = await listGroupMembers(groupId);
            (members || []).forEach((member) => {
              const memberId = String(member?.id || "").trim();
              if (memberId && !userDepartmentMap[memberId]) {
                userDepartmentMap[memberId] = groupLabel;
              }
            });
          } catch {
            // Skip groups that cannot be read; continue best-effort enrichment.
            // Best-effort only.
          }
        }),
      );

      const rows = (ckanUsers || [])
        .filter((user) => String(user?.state || "").toLowerCase() !== "deleted")
        .map((user) => {
          const fullName =
            user?.fullname ||
            user?.display_name ||
            user?.name ||
            user?.email ||
            "CKAN User";
          const ckanOrgId = userOrgMap[String(user?.id || "").trim()] || null;
          const departmentFromMembership =
            userDepartmentMap[String(user?.id || "").trim()] || null;
          const departmentFromExtras =
            getUserExtraValue(user, "department") ||
            getUserExtraValue(user, "dept") ||
            null;
          const department = departmentFromMembership || departmentFromExtras;
          const gsLink =
            getUserExtraValue(user, "google_scholar_link") ||
            getUserExtraValue(user, "scholar_link") ||
            getUserExtraValue(user, "google_scholar") ||
            null;
          const roleExtra =
            String(getUserExtraValue(user, "role") || "")
              .trim()
              .toLowerCase() || "";
          const role = user?.sysadmin
            ? "admin"
            : roleExtra === "admin"
              ? "admin"
              : roleExtra === "student"
                ? "student"
                : roleExtra === "faculty"
                  ? "faculty"
                  : "faculty";
          const isActive =
            String(user?.state || "active").toLowerCase() !== "deleted";
          const liveMetrics =
            liveMetricsByCkanUserId[
              String(user?.id || "")
                .trim()
                .toLowerCase()
            ] || createZeroMetrics();

          return {
            id: user?.id || user?.name || crypto.randomUUID(),
            full_name: String(fullName).trim(),
            email: user?.email || null,
            role,
            department,
            ckan_org_id: ckanOrgId,
            ckan_username: user?.name || null,
            ckan_user_id: user?.id || null,
            source: "ckan_only",
            link_status: "ckan_only",
            is_active: isActive,
            google_scholar_link: gsLink,
            employment_status:
              getUserExtraValue(user, "employment_status") || null,
            designation: getUserExtraValue(user, "designation") || null,
            is_gs_faculty: toBool(
              getUserExtraValue(user, "is_gs_faculty"),
              false,
            ),
            publication_count: liveMetrics.publication_count,
            research_project_count: liveMetrics.research_project_count,
            creative_work_count: liveMetrics.creative_work_count,
            awards_count: liveMetrics.awards_count,
            ip_count: liveMetrics.ip_count,
            created_at: user?.created || null,
            updated_at: user?.activity_streams_email_notifications || null,
          };
        })
        .filter((row) => row.role !== "admin");

      return res.json({
        rows,
        centers: (centers || []).map((center) => ({
          id: center?.name || center?.id,
          name: center?.title || center?.display_name || center?.name || "-",
        })),
        ckan_user_mode: "enabled",
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load affiliates."),
      });
    }
  });

  app.patch(
    "/api/admin/affiliates/:userId",
    authMiddleware,
    async (req, res) => {
      // Local edit is intentionally disabled because source-of-truth is CKAN.
      return res.status(501).json({
        error:
          "CKAN-sourced affiliate records are read-only in this page. Update user details directly in CKAN.",
      });
    },
  );

  app.get(
    "/api/admin/controls/reference-data",
    authMiddleware,
    async (req, res) => {
      try {
        // Aggregate center/department/user references for admin control forms.
        const [centers, departments, ckanUsers] = await Promise.all([
          listOrganizations(),
          listGroups(),
          listUsers(),
        ]);
        const centerChiefByOrg = {};
        await Promise.all(
          (centers || []).map(async (row) => {
            const orgId = row?.name || row?.id;
            if (!orgId) return;
            try {
              const members = await listOrganizationMembers(orgId);
              const adminMember =
                (members || []).find(
                  (member) =>
                    String(member?.capacity || "")
                      .trim()
                      .toLowerCase() === "admin",
                ) || null;
              if (adminMember?.id || adminMember?.name) {
                centerChiefByOrg[orgId] = {
                  id: adminMember?.id || null,
                  name:
                    adminMember?.fullname ||
                    adminMember?.display_name ||
                    adminMember?.name ||
                    adminMember?.email ||
                    null,
                };
              }
            } catch {
              // Ignore failed org-member lookups so endpoint remains available.
              // Best-effort only.
            }
          }),
        );

        return res.json({
          centers: (centers || []).map((row) => ({
            id: row?.name || row?.id,
            name: row?.title || row?.display_name || row?.name || "-",
            code: String(row?.name || row?.id || "")
              .toUpperCase()
              .replace(/[^A-Z0-9_]/g, "_"),
            center_chief_id:
              centerChiefByOrg[row?.name || row?.id]?.id ||
              getExtraValue(row, "center_chief_id"),
            center_chief_name:
              centerChiefByOrg[row?.name || row?.id]?.name ||
              getExtraValue(row, "center_chief_name"),
            agenda_count: 0,
            extras_count: Array.isArray(row?.extras) ? row.extras.length : 0,
          })),
          agendas: [],
          departments: (departments || []).map((row) => ({
            id: row?.name || row?.id,
            name: row?.title || row?.display_name || row?.name || "-",
          })),
          proponents: [],
          ckan_users: (ckanUsers || [])
            .filter(
              (row) => String(row?.state || "").toLowerCase() !== "deleted",
            )
            .map((row) => ({
              id: row?.id || null,
              name:
                row?.name ||
                row?.display_name ||
                row?.fullname ||
                row?.email ||
                "CKAN User",
              username: row?.name || null,
              email: row?.email || null,
              state: row?.state || "active",
            })),
        });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to load admin reference data.",
          ),
        });
      }
    },
  );

  app.get(
    "/api/admin/controls/reference-usage",
    authMiddleware,
    async (req, res) => {
      try {
        const type = String(req.query?.type || "")
          .trim()
          .toLowerCase();
        const id = String(req.query?.id || "").trim();
        if (!id || !["center", "department"].includes(type)) {
          // Return empty usage payload for unsupported or missing reference target.
          return res.json({
            projectCount: 0,
            profileCount: 0,
            memberBreakdown: {
              adminCount: 0,
              editorCount: 0,
              memberCount: 0,
              totalCount: 0,
            },
          });
        }

        const [members, datasets] =
          type === "center"
            ? await Promise.all([
                listOrganizationMembers(id),
                listDatasets({ orgId: id, page: 1, limit: 1 }),
              ])
            : await Promise.all([
                listGroupMembers(id),
                listAllDatasetsAcrossCkan(),
              ]);
        const activeMembers = (members || []).filter(
          (member) =>
            String(member?.state || "active").toLowerCase() !== "deleted",
        );
        const adminCount = activeMembers.filter(
          (member) =>
            String(member?.capacity || "")
              .trim()
              .toLowerCase() === "admin",
        ).length;
        const editorCount = activeMembers.filter(
          (member) =>
            String(member?.capacity || "")
              .trim()
              .toLowerCase() === "editor",
        ).length;
        const memberCount = Math.max(
          0,
          activeMembers.length - adminCount - editorCount,
        );

        return res.json({
          projectCount:
            type === "center"
              ? Number(datasets?.count || 0)
              : (datasets || []).filter((dataset) => {
                  const meta = extrasToMap(dataset?.extras);
                  return String(meta.department_id || "").trim() === id;
                }).length,
          profileCount: activeMembers.length,
          memberBreakdown: {
            adminCount,
            editorCount,
            memberCount,
            totalCount: activeMembers.length,
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load reference usage."),
        });
      }
    },
  );

  app.get(
    "/api/admin/controls/reference-links",
    authMiddleware,
    async (req, res) => {
      try {
        const type = String(req.query?.type || "")
          .trim()
          .toLowerCase();
        const id = String(req.query?.id || "").trim();
        if (type === "center" && id) {
          // Resolve linked members/projects/agendas for a single research center.
          const [agendas, members, datasets, groups] = await Promise.all([
            listOrganizationAgendas(id),
            listOrganizationMembers(id),
            listDatasets({ orgId: id, page: 1, limit: 100 }),
            listGroups(),
          ]);
          const groupNameById = (groups || []).reduce((acc, group) => {
            const key = String(group?.name || group?.id || "").trim();
            if (!key) return acc;
            acc[key] =
              String(
                group?.title || group?.display_name || group?.name || "",
              ).trim() || key;
            return acc;
          }, {});
          const agendaNameById = (agendas || []).reduce((acc, agenda) => {
            const key = String(agenda?.id || "").trim();
            const label = String(agenda?.name || "").trim();
            if (!key || !label) return acc;
            acc[key] = label;
            return acc;
          }, {});

          const profiles = (members || [])
            .filter(
              (member) =>
                String(member?.state || "active").toLowerCase() !== "deleted",
            )
            .map((member) => {
              const memberExtras = extrasToMap(member?.extras);
              const deptId =
                String(
                  memberExtras.department_id || memberExtras.department || "",
                ).trim() || null;
              const roleFromCapacity =
                String(member?.capacity || "")
                  .trim()
                  .toLowerCase() === "admin"
                  ? "admin"
                  : String(member?.capacity || "")
                        .trim()
                        .toLowerCase() === "editor"
                    ? "faculty"
                    : "student";
              return {
                id: member?.id || member?.name || null,
                full_name:
                  member?.fullname ||
                  member?.display_name ||
                  member?.name ||
                  member?.email ||
                  "CKAN User",
                email: member?.email || null,
                role: roleFromCapacity,
                department: deptId ? groupNameById[deptId] || deptId : null,
                is_active: true,
              };
            });

          const projects = (datasets?.datasets || []).map((dataset) => {
            const meta = extrasToMap(dataset?.extras);
            const deptId = String(meta.department_id || "").trim();
            const agendaId = String(meta.research_agenda_id || "").trim();
            return {
              id: dataset?.id || dataset?.name || crypto.randomUUID(),
              title: dataset?.title || dataset?.name || "-",
              status:
                meta.project_status ||
                dataset?.state ||
                (dataset?.private ? "private" : "public"),
              year: meta.project_year || null,
              lead_researcher: meta.lead_researcher || null,
              department_name: deptId ? groupNameById[deptId] || deptId : null,
              agenda_name: agendaId
                ? agendaNameById[agendaId] || agendaId
                : null,
              start_date: meta.start_date || null,
              end_date: meta.end_date || null,
            };
          });

          return res.json({
            profiles,
            projects,
            agendas: agendas.map((row) => ({
              id: row.id || row.name,
              name: row.name || row.id,
            })),
          });
        }
        if (type === "department" && id) {
          const [members, datasets, centers] = await Promise.all([
            listGroupMembers(id),
            listAllDatasetsAcrossCkan(),
            listOrganizations(),
          ]);
          const centerNameById = (centers || []).reduce((acc, center) => {
            const key = String(center?.name || center?.id || "").trim();
            if (!key) return acc;
            acc[key] =
              String(
                center?.title || center?.display_name || center?.name || "",
              ).trim() || key;
            return acc;
          }, {});

          const profiles = (members || [])
            .filter(
              (member) =>
                String(member?.state || "active").toLowerCase() !== "deleted",
            )
            .map((member) => ({
              id: member?.id || member?.name || null,
              full_name:
                member?.fullname ||
                member?.display_name ||
                member?.name ||
                member?.email ||
                "CKAN User",
              email: member?.email || null,
              role:
                String(member?.capacity || "")
                  .trim()
                  .toLowerCase() === "admin"
                  ? "admin"
                  : String(member?.capacity || "")
                        .trim()
                        .toLowerCase() === "editor"
                    ? "faculty"
                    : "student",
              department:
                member?.display_name || member?.fullname || member?.name || null,
              is_active: true,
            }));

          const projects = (datasets || [])
            .filter((dataset) => {
              const meta = extrasToMap(dataset?.extras);
              return String(meta.department_id || "").trim() === id;
            })
            .map((dataset) => {
              const meta = extrasToMap(dataset?.extras);
              const centerId = String(
                dataset?.organization?.name || dataset?.owner_org || "",
              ).trim();
              return {
                id: dataset?.id || dataset?.name || crypto.randomUUID(),
                title: dataset?.title || dataset?.name || "-",
                status:
                  meta.project_status ||
                  dataset?.state ||
                  (dataset?.private ? "private" : "public"),
                year: meta.project_year || null,
                lead_researcher: meta.lead_researcher || null,
                department_name: id,
                research_center_name: centerId
                  ? centerNameById[centerId] || centerId
                  : null,
                start_date: meta.start_date || null,
                end_date: meta.end_date || null,
              };
            });

          return res.json({ profiles, projects, agendas: [] });
        }
        // Default empty response preserves client contract for unsupported types.
        return res.json({ profiles: [], projects: [], agendas: [] });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load reference links."),
        });
      }
    },
  );

  app.post(
    "/api/admin/controls/sync-ckan-orgs",
    authMiddleware,
    async (req, res) => {
      try {
        // Currently reports discoverable organization count as sync summary.
        const centers = await listOrganizations();
        return res.json({
          summary: { synced: Array.isArray(centers) ? centers.length : 0 },
        });
      } catch (error) {
        return res
          .status(500)
          .json({ error: String(error?.message || "Sync failed.") });
      }
    },
  );

  app.post(
    "/api/admin/controls/reassign-dependencies",
    authMiddleware,
    async (req, res) => {
      // Placeholder endpoint reserved for future dependency reassignment workflow.
      return res.json({ data: { updated: 0 } });
    },
  );

  app.post(
    "/api/admin/controls/reference/:type",
    authMiddleware,
    async (req, res) => {
      try {
        const type = String(req.params?.type || "")
          .trim()
          .toLowerCase();
        if (!["center", "department"].includes(type)) {
          return res.status(501).json({
            error: "Only center and department create are implemented in this backend.",
          });
        }

        if (type === "department") {
          const name = String(req.body?.name || "").trim();
          const codeRaw = normalizeDepartmentCode(req.body?.code || name);
          if (!name) return badRequest(res, "Department name is required.");
          if (!codeRaw) return badRequest(res, "Department code is required.");

          const groupName = codeRaw.toLowerCase().replace(/[^a-z0-9_\-]+/g, "-");
          if (!groupName) return badRequest(res, "Department code is invalid.");

          const created = await createGroup({
            name: groupName,
            title: name,
            extras: [{ key: "code", value: codeRaw }],
          });

          return res.status(201).json({
            data: {
              id: created?.name || created?.id || groupName,
              name:
                created?.title ||
                created?.display_name ||
                created?.name ||
                name,
              code: normalizeDepartmentCode(created?.name || codeRaw),
            },
          });
        }

        const name = String(req.body?.name || "").trim();
        const codeRaw = String(req.body?.code || "").trim();
        const centerChiefId = String(req.body?.center_chief_id || "").trim();
        const agendaNames = normalizeAgendaNames(req.body?.research_agendas);
        if (!name) return badRequest(res, "Research center name is required.");
        if (!codeRaw)
          return badRequest(res, "Research center code is required.");
        if (!centerChiefId) {
          return badRequest(res, "Center chief is required.");
        }

        const orgName = codeRaw.toLowerCase().replace(/[^a-z0-9_\-]+/g, "-");
        if (!orgName)
          return badRequest(res, "Research center code is invalid.");

        const users = await listUsers();
        const selected = (users || []).find(
          (row) => String(row?.id || "") === centerChiefId,
        );
        const centerChiefUsername = String(selected?.name || "").trim();
        if (!centerChiefUsername) {
          return badRequest(
            res,
            "Selected center chief CKAN user was not found.",
          );
        }

        const extras = [];
        extras.push({
          key: "code",
          value: codeRaw,
        });
        if (agendaNames.length > 0) {
          extras.push({
            key: "research_agendas",
            value: agendaNames.join("; "),
          });
        }
        let created = null;
        try {
          // Create org first, then assign center chief as org admin.
          created = await createOrganization({
            name: orgName,
            title: name,
            extras,
          });
          await assignUserToOrganizationAdmin({
            orgId: created?.name || created?.id || orgName,
            username: centerChiefUsername,
          });
        } catch (error) {
          if (created?.name || created?.id) {
            try {
              // Roll back partially created organization on membership assignment failure.
              await deleteOrganization(created?.name || created?.id);
            } catch {
              // Best-effort cleanup only.
            }
          }
          throw error;
        }

        return res.status(201).json({
          data: {
            id: created?.name || created?.id || orgName,
            name:
              created?.title || created?.display_name || created?.name || name,
            code: String(created?.name || orgName || "")
              .toUpperCase()
              .replace(/[^A-Z0-9_]/g, "_"),
            center_chief_id: centerChiefId || null,
            center_chief_name:
              String(
                selected?.fullname ||
                  selected?.display_name ||
                  selected?.name ||
                  selected?.email ||
                  "",
              ).trim() || null,
            research_agendas: agendaNames,
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Reference create failed."),
        });
      }
    },
  );

  app.patch(
    "/api/admin/controls/reference/:type/:id",
    authMiddleware,
    async (req, res) => {
      try {
        const type = String(req.params?.type || "")
          .trim()
          .toLowerCase();
        const id = String(req.params?.id || "").trim();
        if (!id) return badRequest(res, "Reference id is required.");
        if (!["center", "department"].includes(type)) {
          return res.status(501).json({
            error: "Only center and department update are implemented in this backend.",
          });
        }

        if (type === "department") {
          const currentGroup = await getGroup(id);
          if (!currentGroup) {
            return res.status(404).json({ error: "Department was not found." });
          }

          const name = String(req.body?.name || "").trim();
          const codeRaw = normalizeDepartmentCode(
            req.body?.code || getExtraValue(currentGroup, "code") || id,
          );
          if (!name && !currentGroup?.title && !currentGroup?.display_name) {
            return badRequest(res, "Department name is required.");
          }
          if (!codeRaw) return badRequest(res, "Department code is required.");

          const existingExtras = Array.isArray(currentGroup?.extras)
            ? currentGroup.extras
            : [];
          const nextExtras = existingExtras.filter(
            (item) =>
              String(item?.key || "")
                .trim()
                .toLowerCase() !== "code",
          );
          nextExtras.push({ key: "code", value: codeRaw });

          const updated = await updateGroupMetadata({
            groupId: id,
            title:
              name || currentGroup?.title || currentGroup?.display_name || id,
            extras: nextExtras,
          });

          return res.json({
            data: {
              id: updated?.name || updated?.id || id,
              name:
                updated?.title || updated?.display_name || updated?.name || id,
              code: codeRaw,
            },
          });
        }

        const currentOrg = await getOrganization(id);
        if (!currentOrg) {
          return res
            .status(404)
            .json({ error: "Research center was not found." });
        }

        const name = String(req.body?.name || "").trim();
        const codeRaw = String(req.body?.code || "").trim();
        const centerChiefId = String(req.body?.center_chief_id || "").trim();
        const agendaNames = normalizeAgendaNames(req.body?.research_agendas);
        const joinedAgenda = agendaNames.join("; ");
        if (!codeRaw)
          return badRequest(res, "Research center code is required.");

        let centerChiefName = "";
        let centerChiefUsername = "";
        if (centerChiefId) {
          const users = await listUsers();
          const selected = (users || []).find(
            (row) => String(row?.id || "") === centerChiefId,
          );
          centerChiefUsername = String(selected?.name || "").trim();
          if (!centerChiefUsername) {
            return badRequest(
              res,
              "Selected center chief CKAN user was not found.",
            );
          }
          centerChiefName = String(
            selected?.fullname ||
              selected?.display_name ||
              selected?.name ||
              selected?.email ||
              "",
          ).trim();
        }

        const existingExtras = Array.isArray(currentOrg?.extras)
          ? currentOrg.extras
          : [];
        // Replace managed extras while preserving unrelated metadata keys.
        const nextExtras = existingExtras.filter((item) => {
          const key = String(item?.key || "")
            .trim()
            .toLowerCase();
          return (
            key !== "code" &&
            key !== "research_agendas" &&
            key !== "research_agenda"
          );
        });

        nextExtras.push({ key: "code", value: codeRaw });
        if (joinedAgenda) {
          nextExtras.push({ key: "research_agendas", value: joinedAgenda });
        }

        const updated = await updateOrganizationMetadata({
          orgId: id,
          title: name || currentOrg?.title || currentOrg?.display_name || id,
          extras: nextExtras,
        });

        if (centerChiefUsername) {
          // Keep single-admin intent by demoting previous admin when rotating center chief.
          const targetOrgId = updated?.name || updated?.id || id;
          let previousAdminUsername = "";
          try {
            const members = await listOrganizationMembers(targetOrgId);
            const currentAdmin = (members || []).find(
              (member) =>
                String(member?.capacity || "")
                  .trim()
                  .toLowerCase() === "admin",
            );
            previousAdminUsername = String(currentAdmin?.name || "").trim();
          } catch {
            previousAdminUsername = "";
          }

          const isSameAdmin =
            previousAdminUsername &&
            previousAdminUsername.toLowerCase() ===
              centerChiefUsername.toLowerCase();

          if (previousAdminUsername && !isSameAdmin) {
            await setOrganizationMemberRole({
              orgId: targetOrgId,
              username: previousAdminUsername,
              role: "editor",
            });
          }

          if (!isSameAdmin) {
            await setOrganizationMemberRole({
              orgId: targetOrgId,
              username: centerChiefUsername,
              role: "admin",
            });
          }
        }

        return res.json({
          data: {
            id: updated?.name || updated?.id || id,
            name:
              updated?.title || updated?.display_name || updated?.name || id,
            code: codeRaw,
            center_chief_id: centerChiefId || null,
            center_chief_name: centerChiefName || null,
            research_agendas: agendaNames,
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Reference update failed."),
        });
      }
    },
  );

  app.delete(
    "/api/admin/controls/reference/:type/:id",
    authMiddleware,
    async (req, res) => {
      try {
        const type = String(req.params?.type || "")
          .trim()
          .toLowerCase();
        const id = String(req.params?.id || "").trim();
        if (!id) {
          return badRequest(res, "Reference id is required.");
        }

        if (type === "department") {
          const [members, datasets] = await Promise.all([
            listGroupMembers(id),
            listAllDatasetsAcrossCkan(),
          ]);
          const linkedProjects = (datasets || []).filter((dataset) => {
            const meta = extrasToMap(dataset?.extras);
            return String(meta.department_id || "").trim() === id;
          });

          if (linkedProjects.length) {
            return res.status(409).json({
              error:
                "Department cannot be deleted while it still has linked projects.",
              details: {
                linkedProjects: linkedProjects.length,
              },
            });
          }

          const removableMembers = (members || []).filter(
            (member) =>
              String(member?.state || "active").toLowerCase() !== "deleted" &&
              String(member?.name || "").trim(),
          );

          for (const member of removableMembers) {
            await removeUserFromGroup({
              groupId: id,
              username: String(member.name || "").trim(),
            });
          }

          await query(
            `
            UPDATE users
            SET
              ckan_group_id = NULL,
              department = CASE
                WHEN COALESCE(ckan_group_id, '') = $1 THEN NULL
                ELSE department
              END,
              updated_at = NOW()
            WHERE COALESCE(ckan_group_id, '') = $1
            `,
            [id],
          );

          await deleteGroup(id);
          return res.json({ data: { id, deleted: true, type } });
        }

        if (type === "center") {
          const [members, datasets] = await Promise.all([
            listOrganizationMembers(id),
            listDatasets({ orgId: id, page: 1, limit: 100 }),
          ]);
          const linkedProjects = Array.isArray(datasets?.datasets)
            ? datasets.datasets
            : [];

          if (linkedProjects.length) {
            return res.status(409).json({
              error:
                "Research center cannot be deleted while it still has linked projects.",
              details: {
                linkedProjects: linkedProjects.length,
              },
            });
          }

          const removableMembers = (members || []).filter(
            (member) =>
              String(member?.state || "active").toLowerCase() !== "deleted" &&
              String(member?.name || "").trim(),
          );

          for (const member of removableMembers) {
            await removeUserFromOrganization({
              orgId: id,
              username: String(member.name || "").trim(),
            });
          }

          await query(
            `
            UPDATE users
            SET
              ckan_org_id = NULL,
              updated_at = NOW()
            WHERE COALESCE(ckan_org_id, '') = $1
            `,
            [id],
          );

          await deleteOrganization(id);
          return res.json({ data: { id, deleted: true, type } });
        }

        return res.status(400).json({
          error: "Unsupported reference delete type.",
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Reference delete failed."),
        });
      }
    },
  );
}
