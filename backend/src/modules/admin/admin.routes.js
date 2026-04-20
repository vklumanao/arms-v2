import crypto from "node:crypto";
import { query } from "../../db/client.js";
import { config } from "../../config/index.js";

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
  const serviceBotEmails = new Set(
    (config.serviceBotEmails || []).map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    ),
  );
  const serviceBotNames = new Set(
    (config.serviceBotNames || []).map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    ),
  );
  const serviceBotIds = new Set(
    (config.serviceBotIds || []).map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    ),
  );
  const isServiceBotProfile = (profile) => {
    if (!profile) return false;
    const email = String(profile?.email || "")
      .trim()
      .toLowerCase();
    const name = String(profile?.full_name || "")
      .trim()
      .toLowerCase();
    const id = String(profile?.id || "")
      .trim()
      .toLowerCase();
    if (email && serviceBotEmails.has(email)) return true;
    if (name && serviceBotNames.has(name)) return true;
    if (id && serviceBotIds.has(id)) return true;
    return false;
  };
  const {
    authMiddleware,
    badRequest,
    parseOrThrow,
    adminCreateProponentSchema,
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
    assignUserToGroupAdmin,
    assignUserToOrganizationAdmin,
    getGroup,
    getOrganization,
    updateGroupMetadata,
    updateGroupMetadataWithDescription,
    updateOrganizationMetadata,
    setGroupMemberRole,
    setOrganizationMemberRole,
    createOrGetUser,
    createUser,
    hashPassword,
    assignUserToOrganizationEditor,
    assignUserToGroupEditor,
    findUserByEmail,
    findUserById,
    updateUser,
    userHasPermission,
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

  function uniqueTrimmed(values, { lower = false } = {}) {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map((value) => asTrimmedString(value))
      .filter(Boolean)
      .map((value) => (lower ? value.toLowerCase() : value))
      .filter((value) => {
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      });
  }

  function getDepartmentReferenceKeys(group) {
    return {
      idKeys: uniqueTrimmed([group?.id, group?.name]),
      labelKeys: uniqueTrimmed(
        [group?.title, group?.display_name, group?.name],
        { lower: true },
      ),
    };
  }

  async function listAssignedDepartmentUsers(group) {
    const { idKeys, labelKeys } = getDepartmentReferenceKeys(group);
    if (idKeys.length === 0 && labelKeys.length === 0) return [];

    const clauses = [];
    const values = [];

    if (idKeys.length > 0) {
      values.push(idKeys);
      clauses.push(`ckan_group_id = ANY($${values.length}::text[])`);
    }

    if (labelKeys.length > 0) {
      values.push(labelKeys);
      clauses.push(
        `LOWER(COALESCE(department, '')) = ANY($${values.length}::text[])`,
      );
    }

    if (clauses.length === 0) return [];

    const result = await query(
      `
      SELECT *
      FROM users
      WHERE is_active = true
        AND role IN ('faculty', 'student')
        AND (${clauses.join(" OR ")})
      ORDER BY full_name ASC, email ASC
      `,
      values,
    );

    return Array.isArray(result.rows) ? result.rows : [];
  }

  async function listAssignedCenterUsers(org) {
    const idKeys = uniqueTrimmed([org?.id, org?.name]);
    if (idKeys.length === 0) return [];

    const result = await query(
      `
      SELECT *
      FROM users
      WHERE is_active = true
        AND role IN ('faculty', 'student')
        AND ckan_org_id = ANY($1::text[])
      ORDER BY full_name ASC, email ASC
      `,
      [idKeys],
    );

    return Array.isArray(result.rows) ? result.rows : [];
  }

  async function findLocalUserByCkanMember(member) {
    const ckanUserId = asTrimmedString(member?.id);
    const ckanUsername = asTrimmedString(member?.name);
    const email = asTrimmedString(member?.email).toLowerCase();

    if (email) {
      const byEmail = await findUserByEmail(email);
      if (byEmail) return byEmail;
    }

    const clauses = [];
    const values = [];

    if (ckanUserId) {
      values.push(ckanUserId);
      clauses.push(`ckan_user_id = $${values.length}`);
    }
    if (ckanUsername) {
      values.push(ckanUsername);
      clauses.push(`ckan_username = $${values.length}`);
    }

    if (clauses.length === 0) return null;

    const result = await query(
      `
      SELECT *
      FROM users
      WHERE ${clauses.join(" OR ")}
      LIMIT 1
      `,
      values,
    );

    return result.rows?.[0] || null;
  }

  async function syncLocalCenterChiefProfile(selectedUser, center) {
    const localUser = await findLocalUserByCkanMember(selectedUser);
    if (!localUser?.id) return null;

    const centerId =
      asTrimmedString(center?.name) || asTrimmedString(center?.id) || null;
    if (!centerId) return null;

    return updateUser(localUser.id, {
      ckan_org_id: centerId,
      ckan_username:
        asTrimmedString(selectedUser?.name) || localUser?.ckan_username || null,
      ckan_user_id:
        asTrimmedString(selectedUser?.id) || localUser?.ckan_user_id || null,
    });
  }

  async function syncLocalDepartmentChairProfile(selectedUser, group, name) {
    const localUser = await findLocalUserByCkanMember(selectedUser);
    if (!localUser?.id) return null;

    const groupId =
      asTrimmedString(group?.name) || asTrimmedString(group?.id) || null;
    if (!groupId) return null;

    const departmentName =
      asTrimmedString(name) ||
      asTrimmedString(group?.title) ||
      asTrimmedString(group?.display_name) ||
      asTrimmedString(group?.name) ||
      null;

    return updateUser(localUser.id, {
      department: departmentName || null,
      ckan_group_id: groupId,
      ckan_username:
        asTrimmedString(selectedUser?.name) || localUser?.ckan_username || null,
      ckan_user_id:
        asTrimmedString(selectedUser?.id) || localUser?.ckan_user_id || null,
    });
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

  function isAwardDataset(dataset) {
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const recordType = String(getDatasetExtraByKey(extras, "record_type") || "")
      .trim()
      .toLowerCase();
    return recordType === "award";
  }

  function parseRecipientUsersFromExtras(extras) {
    const raw = asTrimmedString(
      getDatasetExtraByKey(extras, "recipient_users"),
    );
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function parseRecipientNamesFromExtras(extras) {
    const raw = asTrimmedString(getDatasetExtraByKey(extras, "recipients"));
    if (!raw) return [];
    return raw
      .split(/[,;]+/)
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  }

  function parseSelectedUsers(rawValue) {
    try {
      const parsed = JSON.parse(asTrimmedString(rawValue) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => ({
          id: asTrimmedString(row?.id).toLowerCase(),
          name: asTrimmedString(row?.name),
          username: asTrimmedString(row?.username).toLowerCase(),
          email: asTrimmedString(row?.email).toLowerCase(),
          role: asTrimmedString(row?.role).toLowerCase(),
        }))
        .filter((row) => row.id || row.username || row.email || row.name);
    } catch {
      return [];
    }
  }

  function resolveRecipientIds({
    recipientUsers,
    recipientNames,
    identityToUserId,
    nameToUserId,
    metricsByUserId,
  }) {
    const resolved = new Set();

    (recipientUsers || []).forEach((user) => {
      const id = asTrimmedString(user?.id).toLowerCase();
      if (id) {
        const mapped = identityToUserId.get(`id:${id}`);
        if (mapped) resolved.add(mapped);
        else if (metricsByUserId[id]) resolved.add(id);
      }

      const email = asTrimmedString(user?.email).toLowerCase();
      if (email) {
        const mapped = identityToUserId.get(`email:${email}`);
        if (mapped) resolved.add(mapped);
      }

      const username = asTrimmedString(user?.username).toLowerCase();
      if (username) {
        const mapped = identityToUserId.get(`username:${username}`);
        if (mapped) resolved.add(mapped);
      }

      const name = asTrimmedString(user?.name);
      if (name) {
        buildNameVariants(name).forEach((variant) => {
          const mapped = nameToUserId.get(variant);
          if (mapped) resolved.add(mapped);
        });
      }
    });

    (recipientNames || []).forEach((name) => {
      buildNameVariants(name).forEach((variant) => {
        const mapped = nameToUserId.get(variant);
        if (mapped) resolved.add(mapped);
      });
    });

    return Array.from(resolved).filter(Boolean);
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
    if (
      [
        "creative_work",
        "creative_works",
        "creative",
        "product_software",
        "product_software_application",
        "products_software_application",
      ].includes(base)
    ) {
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
    const fromExplicit = normalizeOutputType(resource?.output_type || "");
    if (fromExplicit) return fromExplicit;
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

  function normalizePersonName(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .replace(/\s+/g, " ");
  }

  function parsePublicationAuthors(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return [];
    if (raw.includes(";")) {
      return raw
        .split(";")
        .map((name) => name.trim())
        .filter(Boolean);
    }
    return [raw];
  }

  function parseExpectedOutputMeta(rawValue) {
    try {
      const parsed = JSON.parse(asTrimmedString(rawValue) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => ({
          output_type: normalizeOutputType(row?.output_type || row?.outputType),
          target_count: Math.max(
            1,
            Number(row?.target_count || row?.targetCount || 1) || 1,
          ),
          output_link: asTrimmedString(row?.output_link || row?.outputLink),
          publication_authors: asTrimmedString(
            row?.publication_authors || row?.publicationAuthors,
          ),
        }))
        .filter((row) => row.output_type);
    } catch {
      return [];
    }
  }

  function buildNameVariants(value) {
    const raw = String(value || "").trim();
    if (!raw) return [];
    const normalized = normalizePersonName(raw);
    const variants = new Set([normalized]);
    if (raw.includes(",")) {
      const parts = raw.split(",").map((part) => part.trim());
      if (parts.length >= 2) {
        const swapped = normalizePersonName(`${parts[1]} ${parts[0]}`);
        if (swapped) variants.add(swapped);
      }
    }
    if (!raw.includes(",")) {
      const tokens = raw
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (tokens.length >= 2) {
        const last = tokens[tokens.length - 1];
        const rest = tokens.slice(0, -1).join(" ");
        const swapped = normalizePersonName(`${last} ${rest}`);
        if (swapped) variants.add(swapped);
      }
    }
    return Array.from(variants).filter(Boolean);
  }

  function extractAuthorsFromDescription(description) {
    const text = String(description || "").trim();
    if (!text) return "";
    const line = text
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) => /authors\/proponents:/i.test(entry));
    if (!line) return "";
    return line.replace(/^.*authors\/proponents:/i, "").trim();
  }

  function normalizeDepartmentCode(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function formatFullName({ first_name, middle_initial, last_name }) {
    const first = String(first_name || "").trim();
    const last = String(last_name || "").trim();
    const middleRaw = String(middle_initial || "")
      .replace(/\./g, "")
      .trim();
    const middle = middleRaw ? middleRaw.charAt(0).toUpperCase() : "";
    const parts = [
      `${last.toUpperCase()},`,
      first.toUpperCase(),
      middle ? `${middle}.` : "",
    ].filter(Boolean);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  async function listProponentAccounts() {
    const result = await query(`
        SELECT
          id,
        full_name,
        email,
        role,
        department,
        ckan_org_id,
        ckan_group_id,
        ckan_username,
        ckan_user_id,
        is_active
        FROM users
        WHERE role IN ('faculty', 'student')
          AND is_active = TRUE
        ORDER BY full_name ASC, email ASC
      `);
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    return rows.map((row) => ({
      id: row.id,
      name: row.full_name || row.email || row.id,
      full_name: row.full_name || row.email || row.id,
      email: row.email || null,
      role: row.role || null,
      department: row.department || null,
      ckan_org_id: row.ckan_org_id || null,
      ckan_group_id: row.ckan_group_id || null,
      ckan_username: row.ckan_username || null,
      ckan_user_id: row.ckan_user_id || null,
      is_active: row.is_active !== false,
    }));
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

  function buildLiveMetricsByCkanUserId(ckanUsers, datasets, nameToUserId) {
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

      if (isAwardDataset(dataset)) {
        const recipientUsers = parseRecipientUsersFromExtras(extras);
        const recipientNames = parseRecipientNamesFromExtras(extras);
        const recipientIds = resolveRecipientIds({
          recipientUsers,
          recipientNames,
          identityToUserId,
          nameToUserId,
          metricsByUserId,
        });

        if (recipientIds.length > 0) {
          recipientIds.forEach((recipientId) => {
            const targetMetrics =
              metricsByUserId[recipientId] || createZeroMetrics();
            targetMetrics.awards_count += 1;
            metricsByUserId[recipientId] = targetMetrics;
          });
        } else {
          metrics.awards_count += 1;
          metricsByUserId[ownerUserId] = metrics;
        }
        return;
      }

      const leadResearchers = parseSelectedUsers(
        getDatasetExtraByKey(extras, "lead_researcher_user"),
      );
      const leadUserIds = Array.from(
        new Set(
          leadResearchers
            .flatMap((lead) => [
              lead?.id ? `id:${lead.id}` : "",
              lead?.email ? `email:${lead.email}` : "",
              lead?.username ? `username:${lead.username}` : "",
            ])
            .filter(Boolean)
            .map((identity) => identityToUserId.get(identity))
            .filter(Boolean),
        ),
      );

      if (leadUserIds.length > 0) {
        leadUserIds.forEach((leadUserId) => {
          const targetMetrics =
            metricsByUserId[leadUserId] || createZeroMetrics();
          targetMetrics.research_project_count += 1;
          metricsByUserId[leadUserId] = targetMetrics;
        });
      } else {
        metrics.research_project_count += 1;
      }

      const expectedOutputs = parseExpectedOutputMeta(
        getDatasetExtraByKey(extras, "expected_outputs_meta"),
      );
      if (expectedOutputs.length > 0) {
        expectedOutputs.forEach((row) => {
          const outputType = normalizeOutputType(row.output_type);
          const authorsRaw = asTrimmedString(row.publication_authors);
          const authorNames = parsePublicationAuthors(authorsRaw);
          const normalizedNames = authorNames.map((name) =>
            normalizePersonName(name),
          );
          const authorIds = new Set(
            normalizedNames
              .map((name) => nameToUserId.get(name))
              .filter(Boolean),
          );
          const increment = Math.max(1, Number(row.target_count || 1) || 1);
          const applyCount = (targetMetrics) => {
            if (outputType === "publication") {
              targetMetrics.publication_count += increment;
            } else if (outputType === "creative_work") {
              targetMetrics.creative_work_count += increment;
            } else if (outputType === "award") {
              targetMetrics.awards_count += increment;
            } else if (outputType === "patent_ip") {
              targetMetrics.ip_count += increment;
            }
          };
          if (authorIds.size > 0) {
            authorIds.forEach((authorId) => {
              const authorMetrics =
                metricsByUserId[authorId] || createZeroMetrics();
              applyCount(authorMetrics);
              metricsByUserId[authorId] = authorMetrics;
            });
          } else {
            applyCount(metrics);
          }
        });
        metricsByUserId[ownerUserId] = metrics;
        return;
      }

      const resources = Array.isArray(dataset?.resources)
        ? dataset.resources
        : [];
      resources.forEach((resource) => {
        const outputType = inferOutputTypeFromResource(resource);
        if (outputType === "publication") {
          const rawFromField = asTrimmedString(resource?.publication_authors);
          const rawFromDescription = extractAuthorsFromDescription(
            resource?.description,
          );
          const authorsRaw = rawFromField || rawFromDescription || "";
          const authorNames = parsePublicationAuthors(authorsRaw);
          const normalizedNames = authorNames.map((name) =>
            normalizePersonName(name),
          );
          const authorIds = new Set(
            normalizedNames
              .map((name) => nameToUserId.get(name))
              .filter(Boolean),
          );
          if (authorIds.size > 0) {
            authorIds.forEach((authorId) => {
              const authorMetrics =
                metricsByUserId[authorId] || createZeroMetrics();
              authorMetrics.publication_count += 1;
              metricsByUserId[authorId] = authorMetrics;
            });
          } else {
            metrics.publication_count += 1;
          }
        }
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

  function getManagedCenterId(user) {
    if (
      String(user?.role || "")
        .trim()
        .toLowerCase() === "admin"
    )
      return "";
    const managedCenterId = String(user?.managed_center_id || "").trim();
    return Boolean(user?.is_center_chief) && managedCenterId
      ? managedCenterId
      : "";
  }

  function isCenterChiefScopedUser(user) {
    return Boolean(getManagedCenterId(user));
  }

  function ensureCenterScope(res, user, centerId) {
    if (
      String(user?.role || "")
        .trim()
        .toLowerCase() === "admin"
    )
      return true;
    const managedCenterId = getManagedCenterId(user);
    if (managedCenterId && managedCenterId === String(centerId || "").trim()) {
      return true;
    }
    res.status(403).json({
      error: "You can only access the Research Center assigned to you.",
    });
    return false;
  }

  function ensureDepartmentScope(res, user, departmentId) {
    void departmentId;
    // Departments admin APIs are admin-only (chairperson does not grant managed access).
    return ensureAdminOnly(res, user);
  }

  function ensureAdminOrCenterChief(res, user) {
    if (typeof userHasPermission === "function") {
      const isAdminByPermission = userHasPermission(
        user,
        "admin.controls.manage",
      );
      const isScopedCenterChiefByPermission =
        userHasPermission(user, "affiliates.view") &&
        isCenterChiefScopedUser(user);
      if (isAdminByPermission || isScopedCenterChiefByPermission) return true;
    }
    const role = String(user?.role || "")
      .trim()
      .toLowerCase();
    if (role === "admin" || isCenterChiefScopedUser(user)) return true;
    res
      .status(403)
      .json({ error: "Admin or Center Chief access is required." });
    return false;
  }

  function ensureAdminOnly(res, user) {
    if (
      String(user?.role || "")
        .trim()
        .toLowerCase() === "admin"
    )
      return true;
    res.status(403).json({ error: "Admin access is required." });
    return false;
  }

  app.get("/api/admin/affiliates", authMiddleware, async (req, res) => {
    try {
      if (!ensureAdminOrCenterChief(res, req.user)) return;
      const managedCenterId = getManagedCenterId(req.user);
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
      const localUsersResult = await query(`SELECT * FROM users`);
      const localUsers = Array.isArray(localUsersResult?.rows)
        ? localUsersResult.rows
        : [];
      const localUserByEmail = new Map(
        localUsers
          .filter((row) => row?.email)
          .map((row) => [
            String(row.email || "")
              .trim()
              .toLowerCase(),
            row,
          ]),
      );
      const localUserByCkanUserId = new Map(
        localUsers
          .filter((row) => row?.ckan_user_id)
          .map((row) => [String(row.ckan_user_id || "").trim(), row]),
      );
      const nameToUserId = new Map();
      (ckanUsers || []).forEach((user) => {
        const userId = asTrimmedString(user?.id).toLowerCase();
        if (!userId) return;
        const name = String(
          user?.fullname || user?.display_name || user?.name || "",
        ).trim();
        buildNameVariants(name).forEach((variant) => {
          if (variant && !nameToUserId.has(variant)) {
            nameToUserId.set(variant, userId);
          }
        });
      });
      (localUsers || []).forEach((user) => {
        const ckanUserId = asTrimmedString(user?.ckan_user_id).toLowerCase();
        if (!ckanUserId) return;
        const name = String(user?.full_name || user?.email || "").trim();
        buildNameVariants(name).forEach((variant) => {
          if (variant && !nameToUserId.has(variant)) {
            nameToUserId.set(variant, ckanUserId);
          }
        });
      });
      const liveMetricsByCkanUserId = buildLiveMetricsByCkanUserId(
        ckanUsers,
        allDatasets,
        nameToUserId,
      );

      const userOrgMap = {};
      const userDepartmentMap = {};
      await Promise.all(
        (managedCenterId
          ? (centers || []).filter(
              (row) =>
                String(row?.name || row?.id || "").trim() === managedCenterId,
            )
          : centers || []
        ).map(async (center) => {
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
          const ckanUserId = String(user?.id || "").trim();
          const email = String(user?.email || "")
            .trim()
            .toLowerCase();
          const localUser =
            localUserByCkanUserId.get(ckanUserId) ||
            localUserByEmail.get(email) ||
            null;
          const fullName =
            localUser?.full_name ||
            user?.fullname ||
            user?.display_name ||
            user?.name ||
            user?.email ||
            "CKAN User";
          const ckanOrgId =
            localUser?.ckan_org_id ||
            userOrgMap[String(user?.id || "").trim()] ||
            null;
          const departmentFromMembership =
            userDepartmentMap[String(user?.id || "").trim()] || null;
          const departmentFromExtras =
            getUserExtraValue(user, "department") ||
            getUserExtraValue(user, "dept") ||
            null;
          const department =
            localUser?.department ||
            departmentFromMembership ||
            departmentFromExtras;
          const gsLink =
            localUser?.google_scholar_link ||
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
            : localUser?.role
              ? String(localUser.role || "")
                  .trim()
                  .toLowerCase()
              : roleExtra === "admin"
                ? "admin"
                : roleExtra === "student"
                  ? "student"
                  : roleExtra === "faculty"
                    ? "faculty"
                    : "faculty";
          const isActive = localUser
            ? localUser.is_active !== false
            : String(user?.state || "active").toLowerCase() !== "deleted";
          const liveMetrics =
            liveMetricsByCkanUserId[
              String(user?.id || "")
                .trim()
                .toLowerCase()
            ] || createZeroMetrics();

          return {
            id: localUser?.id || user?.id || user?.name || crypto.randomUUID(),
            full_name: String(fullName).trim(),
            email: localUser?.email || user?.email || null,
            role,
            department,
            ckan_org_id: ckanOrgId,
            ckan_username: localUser?.ckan_username || user?.name || null,
            ckan_user_id: localUser?.ckan_user_id || user?.id || null,
            source: localUser ? "arms_linked" : "ckan_only",
            link_status: localUser ? "linked" : "ckan_only",
            is_active: isActive,
            google_scholar_link: gsLink,
            employment_status:
              localUser?.employment_status ||
              getUserExtraValue(user, "employment_status") ||
              null,
            designation:
              localUser?.designation ||
              getUserExtraValue(user, "designation") ||
              null,
            is_gs_faculty: localUser
              ? Boolean(localUser.is_gs_faculty)
              : toBool(getUserExtraValue(user, "is_gs_faculty"), false),
            publication_count: Math.max(
              Number(localUser?.publication_count || 0),
              Number(liveMetrics.publication_count || 0),
            ),
            research_project_count: Math.max(
              Number(localUser?.research_project_count || 0),
              Number(liveMetrics.research_project_count || 0),
            ),
            creative_work_count: Math.max(
              Number(localUser?.creative_work_count || 0),
              Number(liveMetrics.creative_work_count || 0),
            ),
            awards_count: Math.max(
              Number(localUser?.awards_count || 0),
              Number(liveMetrics.awards_count || 0),
            ),
            ip_count: Math.max(
              Number(localUser?.ip_count || 0),
              Number(liveMetrics.ip_count || 0),
            ),
            created_at: localUser?.created_at || user?.created || null,
            updated_at:
              localUser?.updated_at ||
              user?.activity_streams_email_notifications ||
              null,
          };
        })
        .filter((row) => row.role !== "admin");

      const scopedRows = managedCenterId
        ? rows.filter(
            (row) => String(row?.ckan_org_id || "").trim() === managedCenterId,
          )
        : rows;

      const visibleCenters = managedCenterId
        ? (centers || []).filter(
            (center) =>
              String(center?.name || center?.id || "").trim() ===
              managedCenterId,
          )
        : centers || [];

      return res.json({
        rows: scopedRows,
        centers: (visibleCenters || []).map((center) => ({
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
      try {
        if (!ensureAdminOrCenterChief(res, req.user)) return;
        const managedCenterId = getManagedCenterId(req.user);
        const userId = String(req.params?.userId || "").trim();
        if (!userId) return badRequest(res, "Affiliate id is required.");

        const existing = await findUserById(userId);
        if (!existing) {
          return res.status(404).json({ error: "Affiliate was not found." });
        }
        if (managedCenterId) {
          const existingOrgId = String(existing?.ckan_org_id || "").trim();
          let isScopedMember =
            existingOrgId && existingOrgId === managedCenterId;

          if (!isScopedMember) {
            const targetUserId = String(existing?.ckan_user_id || "").trim();
            const targetUsername = String(existing?.ckan_username || "").trim();
            if (targetUserId || targetUsername) {
              try {
                const members = await listOrganizationMembers(managedCenterId);
                isScopedMember = (members || []).some((member) => {
                  const memberId = String(member?.id || "").trim();
                  const memberName = String(member?.name || "").trim();
                  return (
                    (targetUserId && memberId === targetUserId) ||
                    (targetUsername && memberName === targetUsername)
                  );
                });
              } catch {
                isScopedMember = false;
              }
            }
          }

          if (!isScopedMember) {
            return res.status(403).json({
              error:
                "You can only manage affiliates assigned to your Research Center.",
            });
          }

          if (
            "ckan_org_id" in req.body &&
            String(req.body?.ckan_org_id || "").trim() !== managedCenterId
          ) {
            return res.status(403).json({
              error:
                "Center Chiefs cannot reassign affiliates outside their Research Center.",
            });
          }
        }

        const requestedGroupId = String(req.body?.ckan_group_id || "").trim();
        let selectedGroup = null;
        if (requestedGroupId) {
          const groups = await listGroups();
          selectedGroup =
            (groups || []).find((row) =>
              [row?.id, row?.name].some(
                (value) =>
                  asTrimmedString(value).toLowerCase() ===
                  requestedGroupId.toLowerCase(),
              ),
            ) || null;
          if (!selectedGroup) {
            return badRequest(res, "Selected department was not found.");
          }
        }

        const hasNameParts =
          "first_name" in req.body ||
          "middle_initial" in req.body ||
          "last_name" in req.body;
        const firstName = String(req.body?.first_name || "").trim();
        const lastName = String(req.body?.last_name || "").trim();
        if (hasNameParts && (!firstName || !lastName)) {
          return badRequest(
            res,
            "First name and last name are required to update the name.",
          );
        }

        const patch = {
          department:
            selectedGroup?.title ||
            selectedGroup?.display_name ||
            selectedGroup?.name ||
            String(req.body?.department || "").trim() ||
            null,
          ckan_group_id:
            selectedGroup?.name ||
            selectedGroup?.id ||
            requestedGroupId ||
            null,
          ckan_org_id: String(req.body?.ckan_org_id || "").trim() || null,
          designation: String(req.body?.designation || "").trim() || null,
          employment_status:
            String(req.body?.employment_status || "").trim() || null,
          google_scholar_link:
            String(req.body?.google_scholar_link || "").trim() || null,
          is_gs_faculty: req.body?.is_gs_faculty === true,
          publication_count: Math.max(
            0,
            Number(req.body?.publication_count || 0) || 0,
          ),
          research_project_count: Math.max(
            0,
            Number(req.body?.research_project_count || 0) || 0,
          ),
          creative_work_count: Math.max(
            0,
            Number(req.body?.creative_work_count || 0) || 0,
          ),
          awards_count: Math.max(0, Number(req.body?.awards_count || 0) || 0),
          ip_count: Math.max(0, Number(req.body?.ip_count || 0) || 0),
        };
        if (hasNameParts) {
          patch.full_name = formatFullName({
            first_name: firstName,
            middle_initial: req.body?.middle_initial || "",
            last_name: lastName,
          });
        }

        const updated = await updateUser(userId, patch);
        if (!updated) {
          return res.status(404).json({ error: "Affiliate was not found." });
        }

        return res.json({
          data: {
            id: updated.id,
            full_name: updated.full_name,
            email: updated.email,
            role: updated.role,
            department: updated.department,
            ckan_org_id: updated.ckan_org_id,
            ckan_group_id: updated.ckan_group_id,
            ckan_username: updated.ckan_username,
            ckan_user_id: updated.ckan_user_id,
            is_active: updated.is_active,
            google_scholar_link: updated.google_scholar_link,
            employment_status: updated.employment_status,
            designation: updated.designation,
            is_gs_faculty: Boolean(updated.is_gs_faculty),
            publication_count: Number(updated.publication_count || 0),
            research_project_count: Number(updated.research_project_count || 0),
            creative_work_count: Number(updated.creative_work_count || 0),
            awards_count: Number(updated.awards_count || 0),
            ip_count: Number(updated.ip_count || 0),
            updated_at: updated.updated_at,
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to update affiliate."),
        });
      }
    },
  );

  app.get(
    "/api/admin/controls/reference-data",
    authMiddleware,
    async (req, res) => {
      try {
        if (!ensureAdminOrCenterChief(res, req.user)) return;
        // Aggregate center/department/user references for admin control forms.
        const [centers, departments, ckanUsers] = await Promise.all([
          listOrganizations(),
          listGroups(),
          listUsers(),
        ]);
        const proponents = await listProponentAccounts();
        const managedCenterId = getManagedCenterId(req.user);
        const visibleCenters = managedCenterId
          ? (centers || []).filter(
              (row) =>
                String(row?.name || row?.id || "").trim() === managedCenterId,
            )
          : centers || [];
        const centerChiefByOrg = {};
        const agendaCountByOrg = {};
        await Promise.all(
          (visibleCenters || []).map(async (row) => {
            const orgId = row?.name || row?.id;
            if (!orgId) return;
            try {
              const [members, agendas] = await Promise.all([
                listOrganizationMembers(orgId),
                listOrganizationAgendas(orgId),
              ]);
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
              agendaCountByOrg[orgId] = Array.isArray(agendas)
                ? agendas.length
                : 0;
            } catch {
              // Ignore failed org-member lookups so endpoint remains available.
              // Best-effort only.
              agendaCountByOrg[orgId] = 0;
            }
          }),
        );

        return res.json({
          centers: (visibleCenters || []).map((row) => {
            const orgId = row?.name || row?.id;
            const savedChiefId = getExtraValue(row, "center_chief_id");
            const savedChiefName = getExtraValue(row, "center_chief_name");
            const chiefNameFromSavedId =
              (ckanUsers || []).find(
                (user) =>
                  String(user?.id || "").trim() ===
                  String(savedChiefId || "").trim(),
              )?.fullname ||
              (ckanUsers || []).find(
                (user) =>
                  String(user?.id || "").trim() ===
                  String(savedChiefId || "").trim(),
              )?.display_name ||
              (ckanUsers || []).find(
                (user) =>
                  String(user?.id || "").trim() ===
                  String(savedChiefId || "").trim(),
              )?.name ||
              (ckanUsers || []).find(
                (user) =>
                  String(user?.id || "").trim() ===
                  String(savedChiefId || "").trim(),
              )?.email ||
              "";

            return {
              id: orgId,
              name: row?.title || row?.display_name || row?.name || "-",
              description:
                String(
                  row?.description || getExtraValue(row, "description") || "",
                ).trim() || null,
              code:
                String(getExtraValue(row, "code") || "").trim() ||
                String(row?.name || row?.id || "")
                  .toUpperCase()
                  .replace(/[^A-Z0-9_]/g, "_"),
              social_media_link:
                String(getExtraValue(row, "social_media_link") || "").trim() ||
                null,
              center_chief_id:
                savedChiefId || centerChiefByOrg[orgId]?.id || null,
              center_chief_name:
                savedChiefName ||
                chiefNameFromSavedId ||
                centerChiefByOrg[orgId]?.name ||
                null,
              agenda_count: Number(agendaCountByOrg[orgId] || 0),
              extras_count: Array.isArray(row?.extras) ? row.extras.length : 0,
            };
          }),
          agendas: [],
          departments: (departments || []).map((row) => ({
            id: row?.name || row?.id,
            name: row?.title || row?.display_name || row?.name || "-",
            code:
              String(getExtraValue(row, "code") || "").trim() ||
              String(row?.name || row?.id || "")
                .toUpperCase()
                .replace(/[^A-Z0-9_]/g, "_"),
            description:
              String(
                row?.description || getExtraValue(row, "description") || "",
              ).trim() || null,
            social_media_link:
              String(getExtraValue(row, "social_media_link") || "").trim() ||
              null,
            chairperson_id: getExtraValue(row, "chairperson_id"),
            chairperson_name: getExtraValue(row, "chairperson_name"),
          })),
          proponents,
          ckan_users: await Promise.all(
            (ckanUsers || [])
              .filter(
                (row) => String(row?.state || "").toLowerCase() !== "deleted",
              )
              .map(async (row) => {
                const email = String(row?.email || "")
                  .trim()
                  .toLowerCase();
                const armsUser = email ? await findUserByEmail(email) : null;
                const role = String(armsUser?.role || "")
                  .trim()
                  .toLowerCase();
                if (role !== "faculty") return null;
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
                  role,
                };
              }),
          ).then((rows) => rows.filter(Boolean)),
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
        if (type === "center" && !ensureCenterScope(res, req.user, id)) return;
        if (type === "department" && !ensureDepartmentScope(res, req.user, id))
          return;

        const [members, datasets, centerOrg] =
          type === "center"
            ? await Promise.all([
                listOrganizationMembers(id),
                listDatasets({ orgId: id, page: 1, limit: 1 }),
                getOrganization(id),
              ])
            : await Promise.all([
                listGroupMembers(id),
                listAllDatasetsAcrossCkan(),
                getGroup(id),
              ]);
        const [centerUsers, departmentUsers] = await Promise.all([
          type === "center" ? listAssignedCenterUsers(centerOrg) : [],
          type === "department" ? listAssignedDepartmentUsers(centerOrg) : [],
        ]);
        const activeMembers = (members || []).filter(
          (member) =>
            String(member?.state || "active").toLowerCase() !== "deleted",
        );
        const nonAdminMembers = activeMembers.filter(
          (member) =>
            String(member?.capacity || "")
              .trim()
              .toLowerCase() !== "admin",
        );
        const savedCenterChiefId =
          type === "center"
            ? String(getExtraValue(centerOrg, "center_chief_id") || "").trim()
            : "";
        const savedChairpersonId =
          type === "department"
            ? String(getExtraValue(centerOrg, "chairperson_id") || "").trim()
            : "";
        const countedChief =
          type === "center" && savedCenterChiefId
            ? activeMembers.find(
                (member) =>
                  String(member?.id || "").trim() === savedCenterChiefId,
              ) || null
            : null;
        const countedChairperson =
          type === "department" && savedChairpersonId
            ? activeMembers.find(
                (member) =>
                  String(member?.id || "").trim() === savedChairpersonId,
              ) || null
            : null;
        const departmentUserRows =
          type === "department" && departmentUsers.length > 0
            ? departmentUsers
            : [];
        const departmentChairperson =
          type === "department" && savedChairpersonId
            ? departmentUserRows.find(
                (user) =>
                  asTrimmedString(user?.ckan_user_id) === savedChairpersonId,
              ) || null
            : null;
        const centerUserRows =
          type === "center" && centerUsers.length > 0 ? centerUsers : [];
        const countedCenterChief =
          type === "center" && savedCenterChiefId
            ? centerUserRows.find(
                (user) =>
                  asTrimmedString(user?.ckan_user_id) === savedCenterChiefId,
              ) || null
            : null;
        let adminCount = 0;
        let editorCount = 0;
        let memberCount = 0;
        let totalAffiliates = 0;
        let centerProfilesLength = null;

        if (type === "center") {
          const ckanProfiles = await Promise.all(
            activeMembers.map(async (member) => {
              const localUser = await findLocalUserByCkanMember(member);
              const capacity = String(member?.capacity || "")
                .trim()
                .toLowerCase();
              const roleFromCapacity =
                capacity === "admin"
                  ? "admin"
                  : capacity === "editor"
                    ? "faculty"
                    : "student";
              return {
                id: member?.id || member?.name || null,
                full_name:
                  member?.fullname ||
                  member?.display_name ||
                  member?.name ||
                  localUser?.full_name ||
                  localUser?.email ||
                  member?.email ||
                  "CKAN User",
                email: member?.email || localUser?.email || null,
                role:
                  String(localUser?.role || "")
                    .trim()
                    .toLowerCase() || roleFromCapacity,
                is_active: localUser ? localUser.is_active !== false : true,
              };
            }),
          );
          const assignedProfiles = centerUserRows.map((user) => ({
            id: user?.ckan_user_id || user?.id || user?.email || null,
            full_name: user?.full_name || user?.email || "ARMS User",
            email: user?.email || null,
            role: String(user?.role || "student")
              .trim()
              .toLowerCase(),
            is_active: user?.is_active !== false,
          }));
          let profiles = Array.from(
            [...ckanProfiles, ...assignedProfiles]
              .reduce((acc, profile) => {
                const key =
                  asTrimmedString(profile?.email).toLowerCase() ||
                  asTrimmedString(profile?.id).toLowerCase();
                if (!key) return acc;
                if (!acc.has(key)) {
                  acc.set(key, profile);
                  return acc;
                }
                const current = acc.get(key);
                acc.set(key, {
                  ...current,
                  ...profile,
                  email: profile?.email || current?.email,
                  role: profile?.role || current?.role,
                });
                return acc;
              }, new Map())
              .values(),
          );
          const chiefKey = asTrimmedString(savedCenterChiefId).toLowerCase();
          if (chiefKey) {
            const chiefInProfiles = profiles.some(
              (profile) =>
                asTrimmedString(profile?.id).toLowerCase() === chiefKey ||
                asTrimmedString(profile?.email).toLowerCase() === chiefKey,
            );
            if (!chiefInProfiles) {
              const chiefProfile = {
                id: savedCenterChiefId,
                full_name: "Center Chief",
                email: null,
                role: "admin",
                is_active: true,
              };
              if (!isServiceBotProfile(chiefProfile)) {
                profiles = [...profiles, chiefProfile];
              }
            }
          }
          const normalized = profiles
            .filter((profile) => !isServiceBotProfile(profile))
            .map((profile) => ({
              ...profile,
              isChief:
                chiefKey &&
                (asTrimmedString(profile?.id).toLowerCase() === chiefKey ||
                  asTrimmedString(profile?.email).toLowerCase() === chiefKey),
            }));
          adminCount = normalized.filter(
            (profile) => profile.isChief || profile.role === "admin",
          ).length;
          editorCount = normalized.filter(
            (profile) => !profile.isChief && profile.role === "faculty",
          ).length;
          memberCount = normalized.filter(
            (profile) =>
              !profile.isChief &&
              profile.role !== "admin" &&
              profile.role !== "faculty",
          ).length;
          totalAffiliates = normalized.length;
          centerProfilesLength = normalized.length;
        } else {
          adminCount = departmentChairperson || countedChairperson ? 1 : 0;
          const memberCapacityByKey = activeMembers.reduce((acc, member) => {
            const capacity = String(member?.capacity || "")
              .trim()
              .toLowerCase();
            const keys = uniqueTrimmed([
              member?.id,
              member?.name,
              member?.email,
            ]);
            keys.forEach((key) => {
              acc[key] = capacity;
            });
            return acc;
          }, {});
          editorCount = nonAdminMembers.filter(
            (member) =>
              String(member?.capacity || "")
                .trim()
                .toLowerCase() === "editor",
          ).length;
          memberCount = Math.max(0, nonAdminMembers.length - editorCount);

          if (departmentUserRows.length > 0) {
            const nonChiefUsers = departmentUserRows.filter(
              (user) =>
                asTrimmedString(user?.ckan_user_id) !== savedChairpersonId,
            );
            editorCount = nonChiefUsers.filter((user) => {
              const keys = uniqueTrimmed([
                user?.ckan_user_id,
                user?.ckan_username,
                user?.email,
              ]);
              return keys.some((key) => memberCapacityByKey[key] === "editor");
            }).length;
            memberCount = Math.max(0, nonChiefUsers.length - editorCount);
          }

          totalAffiliates =
            departmentUserRows.length > 0
              ? memberCount + editorCount
              : nonAdminMembers.length;
        }

        const responsePayload = {
          projectCount:
            type === "center"
              ? Number(datasets?.count || 0)
              : (datasets || []).filter((dataset) => {
                  const meta = extrasToMap(dataset?.extras);
                  return String(meta.department_id || "").trim() === id;
                }).length,
          profileCount: totalAffiliates,
          memberBreakdown: {
            adminCount,
            editorCount,
            memberCount,
            totalCount: totalAffiliates,
          },
        };
        return res.json(responsePayload);
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
          if (!ensureCenterScope(res, req.user, id)) return;
          // Resolve linked members/projects/agendas for a single research center.
          const [agendas, members, datasets, groups, centerOrg] =
            await Promise.all([
              listOrganizationAgendas(id),
              listOrganizationMembers(id),
              listDatasets({ orgId: id, page: 1, limit: 100 }),
              listGroups(),
              getOrganization(id),
            ]);
          const centerUsers = await listAssignedCenterUsers(centerOrg);
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

          const ckanProfiles = await Promise.all(
            (members || [])
              .filter(
                (member) =>
                  String(member?.state || "active").toLowerCase() !== "deleted",
              )
              .map(async (member) => {
                const memberExtras = extrasToMap(member?.extras);
                const deptId =
                  String(
                    memberExtras.department_id || memberExtras.department || "",
                  ).trim() || null;
                const localUser = await findLocalUserByCkanMember(member);
                const capacity = String(member?.capacity || "")
                  .trim()
                  .toLowerCase();
                const roleFromCapacity =
                  capacity === "admin"
                    ? "admin"
                    : capacity === "editor"
                      ? "faculty"
                      : "student";
                return {
                  id: member?.id || member?.name || null,
                  full_name:
                    member?.fullname ||
                    member?.display_name ||
                    member?.name ||
                    localUser?.full_name ||
                    localUser?.email ||
                    member?.email ||
                    "CKAN User",
                  email: member?.email || localUser?.email || null,
                  role:
                    String(localUser?.role || "")
                      .trim()
                      .toLowerCase() || roleFromCapacity,
                  department:
                    localUser?.department ||
                    (deptId ? groupNameById[deptId] || deptId : null),
                  is_active: localUser ? localUser.is_active !== false : true,
                };
              }),
          );
          const ckanProfileByKey = new Map();
          ckanProfiles.forEach((profile) => {
            uniqueTrimmed([profile?.id, profile?.email], {
              lower: true,
            }).forEach((key) => {
              ckanProfileByKey.set(key, profile);
            });
          });
          const assignedProfiles = centerUsers.map((user) => {
            const existing =
              ckanProfileByKey.get(
                asTrimmedString(user?.ckan_user_id).toLowerCase(),
              ) ||
              ckanProfileByKey.get(
                asTrimmedString(user?.email).toLowerCase(),
              ) ||
              null;
            return {
              id: user?.ckan_user_id || user?.id || user?.email || null,
              full_name:
                existing?.full_name ||
                user?.full_name ||
                user?.email ||
                "ARMS User",
              email: existing?.email || user?.email || null,
              role:
                existing?.role ||
                String(user?.role || "student")
                  .trim()
                  .toLowerCase(),
              department: existing?.department || user?.department || null,
              is_active: user?.is_active !== false,
            };
          });
          let profiles = Array.from(
            [...ckanProfiles, ...assignedProfiles]
              .reduce((acc, profile) => {
                const key =
                  asTrimmedString(profile?.email).toLowerCase() ||
                  asTrimmedString(profile?.id).toLowerCase();
                if (!key) return acc;
                if (!acc.has(key)) {
                  acc.set(key, profile);
                  return acc;
                }
                const current = acc.get(key);
                acc.set(key, {
                  ...current,
                  ...profile,
                  full_name: profile?.full_name || current?.full_name,
                  email: profile?.email || current?.email,
                  department: profile?.department || current?.department,
                  role: profile?.role || current?.role,
                });
                return acc;
              }, new Map())
              .values(),
          );
          profiles = profiles.filter(
            (profile) => !isServiceBotProfile(profile),
          );
          const centerChiefId = String(
            getExtraValue(centerOrg, "center_chief_id") || "",
          ).trim();
          const centerChiefName = String(
            getExtraValue(centerOrg, "center_chief_name") || "",
          ).trim();
          if (centerChiefId) {
            const chiefKey = asTrimmedString(centerChiefId).toLowerCase();
            const existingChief =
              profiles.find(
                (profile) =>
                  asTrimmedString(profile?.id).toLowerCase() === chiefKey ||
                  asTrimmedString(profile?.email).toLowerCase() === chiefKey,
              ) || ckanProfileByKey.get(chiefKey);
            if (!existingChief) {
              const chiefProfile = {
                id: centerChiefId,
                full_name: centerChiefName || "Center Chief",
                email: null,
                role: "admin",
                department: null,
                is_active: true,
              };
              if (!isServiceBotProfile(chiefProfile)) {
                profiles = [...profiles, chiefProfile];
              }
            }
          }

          const projects = (datasets?.datasets || []).map((dataset) => {
            const meta = extrasToMap(dataset?.extras);
            const deptId = String(meta.department_id || "").trim();
            const agendaId = String(meta.research_agenda_id || "").trim();
            const agendaNameFromMeta = String(
              meta.research_agenda ||
                meta.research_agendas ||
                meta.agenda_name ||
                meta.agenda ||
                "",
            ).trim();
            return {
              id: dataset?.id || dataset?.name || crypto.randomUUID(),
              title: dataset?.title || dataset?.name || "-",
              status: meta.project_status || meta.status || "ongoing",
              year: meta.project_year || null,
              lead_researcher: meta.lead_researcher || null,
              department_name: deptId ? groupNameById[deptId] || deptId : null,
              agenda_name: agendaId
                ? agendaNameById[agendaId] || agendaId
                : agendaNameFromMeta || null,
              start_date: meta.start_date || null,
              end_date: meta.end_date || null,
            };
          });

          const responsePayload = {
            profiles,
            projects,
            agendas: agendas.map((row) => ({
              id: row.id || row.name,
              name: row.name || row.id,
            })),
          };
          return res.json(responsePayload);
        }
        if (type === "department" && id) {
          if (!ensureDepartmentScope(res, req.user, id)) return;
          const [members, datasets, centers, departmentGroup] =
            await Promise.all([
              listGroupMembers(id),
              listAllDatasetsAcrossCkan(),
              listOrganizations(),
              getGroup(id),
            ]);
          const departmentUsers =
            await listAssignedDepartmentUsers(departmentGroup);
          const centerNameById = (centers || []).reduce((acc, center) => {
            const key = String(center?.name || center?.id || "").trim();
            if (!key) return acc;
            acc[key] =
              String(
                center?.title || center?.display_name || center?.name || "",
              ).trim() || key;
            return acc;
          }, {});
          const savedChairpersonId = String(
            getExtraValue(departmentGroup, "chairperson_id") || "",
          ).trim();

          const profiles =
            departmentUsers.length > 0
              ? departmentUsers.map((user) => ({
                  id: user?.id || user?.ckan_user_id || user?.email || null,
                  full_name: user?.full_name || user?.email || "ARMS User",
                  email: user?.email || null,
                  role:
                    asTrimmedString(user?.ckan_user_id) === savedChairpersonId
                      ? "admin"
                      : String(user?.role || "student")
                          .trim()
                          .toLowerCase(),
                  department:
                    departmentGroup?.title ||
                    departmentGroup?.display_name ||
                    departmentGroup?.name ||
                    id,
                  is_active: user?.is_active !== false,
                }))
              : (members || [])
                  .filter(
                    (member) =>
                      String(member?.state || "active").toLowerCase() !==
                      "deleted",
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
                      departmentGroup?.title ||
                      departmentGroup?.display_name ||
                      departmentGroup?.name ||
                      id,
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
              const agendaId = String(meta.research_agenda_id || "").trim();
              const agendaNameFromMeta = String(
                meta.research_agenda ||
                  meta.research_agendas ||
                  meta.agenda_name ||
                  meta.agenda ||
                  "",
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
                department_name:
                  departmentGroup?.title ||
                  departmentGroup?.display_name ||
                  departmentGroup?.name ||
                  id,
                research_center_name: centerId
                  ? centerNameById[centerId] || centerId
                  : null,
                agenda_name: agendaNameFromMeta || agendaId || null,
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
    "/api/admin/controls/proponents/accounts",
    authMiddleware,
    async (req, res) => {
      try {
        if (!ensureAdminOnly(res, req.user)) return;

        const parsed = parseOrThrow(
          adminCreateProponentSchema,
          req.body || {},
          "Invalid proponent account payload.",
        );

        const full_name = formatFullName(parsed);
        const email = String(parsed.email || "")
          .trim()
          .toLowerCase();
        const role = String(parsed.role || "faculty")
          .trim()
          .toLowerCase();
        const requestedOrgId = String(parsed.ckan_org_id || "").trim();
        const requestedGroupId = String(parsed.ckan_group_id || "").trim();
        const requestedDepartment = String(parsed.department || "").trim();

        const existing = await findUserByEmail(email);
        if (existing) {
          return res
            .status(409)
            .json({ error: "An account with that email already exists." });
        }

        let selectedOrg = null;
        let selectedGroup = null;

        if (requestedOrgId) {
          const organizations = await listOrganizations();
          selectedOrg = (organizations || []).find(
            (row) =>
              String(row?.id || row?.name || "")
                .trim()
                .toLowerCase() === requestedOrgId.toLowerCase(),
          );
          if (!selectedOrg) {
            return badRequest(res, "Selected research center was not found.");
          }
        }

        if (requestedGroupId) {
          const groups = await listGroups();
          selectedGroup = (groups || []).find(
            (row) =>
              String(row?.id || row?.name || "")
                .trim()
                .toLowerCase() === requestedGroupId.toLowerCase(),
          );
          if (!selectedGroup) {
            return badRequest(res, "Selected department was not found.");
          }
        }

        const temporaryPassword = `Arms!${crypto.randomUUID().slice(0, 8)}`;
        const ckanUser = await createOrGetUser({
          email,
          fullName: full_name,
          password: temporaryPassword,
        });

        if (selectedOrg) {
          await assignUserToOrganizationEditor({
            orgId: selectedOrg.name || selectedOrg.id,
            username: ckanUser.name,
          });
        }

        if (selectedGroup) {
          await assignUserToGroupEditor({
            groupId: selectedGroup.name || selectedGroup.id,
            username: ckanUser.name,
          });
        }

        const password_hash = await hashPassword(temporaryPassword);
        const created = await createUser({
          full_name,
          email,
          password_hash,
          role,
          department:
            selectedGroup?.title ||
            selectedGroup?.display_name ||
            selectedGroup?.name ||
            requestedDepartment ||
            null,
          ckan_org_id: selectedOrg?.name || selectedOrg?.id || null,
          ckan_group_id: selectedGroup?.name || selectedGroup?.id || null,
          ckan_username: ckanUser.name,
          ckan_user_id: ckanUser.id || null,
          is_active: true,
        });

        return res.status(201).json({
          data: {
            id: created.id,
            name: created.full_name || created.email || created.id,
            full_name: created.full_name || null,
            email: created.email || null,
            role: created.role || null,
            department: created.department || null,
            ckan_org_id: created.ckan_org_id || null,
            ckan_group_id: created.ckan_group_id || null,
            ckan_username: created.ckan_username || null,
            ckan_user_id: created.ckan_user_id || null,
            is_active: created.is_active !== false,
            temporary_password: temporaryPassword,
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Proponent account create failed."),
        });
      }
    },
  );

  app.post(
    "/api/admin/controls/reference/:type",
    authMiddleware,
    async (req, res) => {
      try {
        if (!ensureAdminOnly(res, req.user)) return;
        const type = String(req.params?.type || "")
          .trim()
          .toLowerCase();
        if (type === "proponent") {
          return res.status(501).json({
            error:
              "Use the proponent account creation endpoint for this workflow.",
          });
        }
        if (!["center", "department"].includes(type)) {
          return res.status(501).json({
            error:
              "Only center and department create are implemented in this backend.",
          });
        }

        if (type === "department") {
          const name = String(req.body?.name || "").trim();
          const codeRaw = normalizeDepartmentCode(req.body?.code || name);
          const description = String(req.body?.description || "").trim();
          const chairpersonId = String(req.body?.chairperson_id || "").trim();
          const socialMediaLink = String(
            req.body?.social_media_link || "",
          ).trim();
          if (!name) return badRequest(res, "Department name is required.");
          if (!codeRaw) return badRequest(res, "Department code is required.");
          if (!chairpersonId)
            return badRequest(res, "Chairperson is required.");

          const groupName = codeRaw
            .toLowerCase()
            .replace(/[^a-z0-9_\-]+/g, "-");
          if (!groupName) return badRequest(res, "Department code is invalid.");

          const users = await listUsers();
          const selected = (users || []).find(
            (row) => String(row?.id || "") === chairpersonId,
          );
          if (!selected) {
            return badRequest(
              res,
              "Selected chairperson CKAN user was not found.",
            );
          }
          const chairpersonName =
            String(
              selected?.fullname ||
                selected?.display_name ||
                selected?.name ||
                selected?.email ||
                "",
            ).trim() || null;

          const created = await createGroup({
            name: groupName,
            title: name,
            description: description || "",
            extras: [
              { key: "code", value: codeRaw },
              { key: "chairperson_id", value: chairpersonId },
              { key: "chairperson_name", value: chairpersonName },
              ...(socialMediaLink
                ? [{ key: "social_media_link", value: socialMediaLink }]
                : []),
            ],
          });
          await assignUserToGroupAdmin({
            groupId: created?.name || created?.id || groupName,
            username: String(selected?.name || "").trim(),
          });
          await syncLocalDepartmentChairProfile(
            selected,
            created || { name: groupName },
            name,
          );

          return res.status(201).json({
            data: {
              id: created?.name || created?.id || groupName,
              name:
                created?.title ||
                created?.display_name ||
                created?.name ||
                name,
              code: normalizeDepartmentCode(created?.name || codeRaw),
              chairperson_id: chairpersonId,
              chairperson_name: chairpersonName,
              description: description || null,
              social_media_link: socialMediaLink || null,
            },
          });
        }

        const name = String(req.body?.name || "").trim();
        const codeRaw = String(req.body?.code || "").trim();
        const description = String(req.body?.description || "").trim();
        const centerChiefId = String(req.body?.center_chief_id || "").trim();
        const socialMediaLink = String(
          req.body?.social_media_link || "",
        ).trim();
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
        extras.push({
          key: "center_chief_id",
          value: centerChiefId,
        });
        extras.push({
          key: "center_chief_name",
          value:
            String(
              selected?.fullname ||
                selected?.display_name ||
                selected?.name ||
                selected?.email ||
                "",
            ).trim() || centerChiefUsername,
        });
        if (agendaNames.length > 0) {
          extras.push({
            key: "research_agendas",
            value: agendaNames.join("; "),
          });
        }
        if (socialMediaLink) {
          extras.push({
            key: "social_media_link",
            value: socialMediaLink,
          });
        }
        let created = null;
        try {
          // Create org first, then assign center chief as org admin.
          created = await createOrganization({
            name: orgName,
            title: name,
            description: description || "",
            extras,
          });
          await assignUserToOrganizationAdmin({
            orgId: created?.name || created?.id || orgName,
            username: centerChiefUsername,
          });
          await syncLocalCenterChiefProfile(
            selected,
            created || { name: orgName },
          );
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
            description: description || null,
            research_agendas: agendaNames,
            social_media_link: socialMediaLink || null,
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
        if (type === "proponent") {
          if (!ensureAdminOnly(res, req.user)) return;
          const nextName = String(req.body?.name || "").trim();
          if (!nextName) return badRequest(res, "Proponent name is required.");
          const updated = await updateUser(id, { full_name: nextName });
          if (!updated) {
            return res.status(404).json({ error: "Proponent was not found." });
          }
          return res.json({
            data: {
              id: updated.id,
              name: updated.full_name || updated.email || updated.id,
              full_name: updated.full_name || updated.email || updated.id,
              email: updated.email || null,
              role: updated.role || null,
              department: updated.department || null,
              ckan_org_id: updated.ckan_org_id || null,
              ckan_group_id: updated.ckan_group_id || null,
              ckan_username: updated.ckan_username || null,
              ckan_user_id: updated.ckan_user_id || null,
              is_active: updated.is_active !== false,
            },
          });
        }
        if (!["center", "department"].includes(type)) {
          return res.status(501).json({
            error:
              "Only center and department update are implemented in this backend.",
          });
        }
        if (type === "department" && !ensureDepartmentScope(res, req.user, id))
          return;
        if (type === "center" && !ensureCenterScope(res, req.user, id)) return;

        if (type === "department") {
          const currentGroup = await getGroup(id);
          if (!currentGroup) {
            return res.status(404).json({ error: "Department was not found." });
          }

          const name = String(req.body?.name || "").trim();
          const codeRaw = normalizeDepartmentCode(
            req.body?.code || getExtraValue(currentGroup, "code") || id,
          );
          const chairpersonId = String(req.body?.chairperson_id || "").trim();
          const socialMediaLink = String(
            req.body?.social_media_link || "",
          ).trim();
          if (!name && !currentGroup?.title && !currentGroup?.display_name) {
            return badRequest(res, "Department name is required.");
          }
          if (!codeRaw) return badRequest(res, "Department code is required.");
          if (!chairpersonId) {
            return badRequest(res, "Chairperson is required.");
          }

          const users = await listUsers();
          const selected = (users || []).find(
            (row) => String(row?.id || "") === chairpersonId,
          );
          if (!selected) {
            return badRequest(
              res,
              "Selected chairperson CKAN user was not found.",
            );
          }
          const chairpersonName =
            String(
              selected?.fullname ||
                selected?.display_name ||
                selected?.name ||
                selected?.email ||
                "",
            ).trim() || null;

          const existingExtras = Array.isArray(currentGroup?.extras)
            ? currentGroup.extras
            : [];
          const nextExtras = existingExtras.filter((item) => {
            const key = String(item?.key || "")
              .trim()
              .toLowerCase();
            return (
              key !== "code" &&
              key !== "chairperson_id" &&
              key !== "chairperson_name" &&
              key !== "social_media_link"
            );
          });
          nextExtras.push({ key: "code", value: codeRaw });
          nextExtras.push({ key: "chairperson_id", value: chairpersonId });
          nextExtras.push({ key: "chairperson_name", value: chairpersonName });
          if (socialMediaLink) {
            nextExtras.push({
              key: "social_media_link",
              value: socialMediaLink,
            });
          }

          const updated = await updateGroupMetadataWithDescription({
            groupId: id,
            title:
              name || currentGroup?.title || currentGroup?.display_name || id,
            description: String(req.body?.description || "").trim(),
            extras: nextExtras,
          });

          const targetGroupId = updated?.name || updated?.id || id;
          let previousAdminUsername = "";
          try {
            const members = await listGroupMembers(targetGroupId);
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

          const nextChairpersonUsername = String(selected?.name || "").trim();
          const isSameAdmin =
            previousAdminUsername &&
            previousAdminUsername.toLowerCase() ===
              nextChairpersonUsername.toLowerCase();

          if (previousAdminUsername && !isSameAdmin) {
            await setGroupMemberRole({
              groupId: targetGroupId,
              username: previousAdminUsername,
              role: "editor",
            });
          }

          if (!isSameAdmin) {
            await setGroupMemberRole({
              groupId: targetGroupId,
              username: nextChairpersonUsername,
              role: "admin",
            });
          }
          await syncLocalDepartmentChairProfile(
            selected,
            updated || { name: targetGroupId },
            name || currentGroup?.title || currentGroup?.display_name || id,
          );

          return res.json({
            data: {
              id: updated?.name || updated?.id || id,
              name:
                updated?.title || updated?.display_name || updated?.name || id,
              code: codeRaw,
              chairperson_id: chairpersonId,
              chairperson_name: chairpersonName,
              description:
                String(req.body?.description || "").trim() ||
                String(updated?.description || "").trim() ||
                null,
              social_media_link: socialMediaLink || null,
            },
          });
        }

        const currentOrg = await getOrganization(id);
        if (!currentOrg) {
          return res
            .status(404)
            .json({ error: "Research center was not found." });
        }
        const isScopedChief =
          String(req.user?.role || "")
            .trim()
            .toLowerCase() !== "admin";

        const name = String(req.body?.name || "").trim();
        const codeRaw = String(req.body?.code || "").trim();
        const description = String(req.body?.description || "").trim();
        const savedCenterChiefId = String(
          getExtraValue(currentOrg, "center_chief_id") || "",
        ).trim();
        const socialMediaLink = String(
          req.body?.social_media_link || "",
        ).trim();
        const centerChiefId = isScopedChief
          ? savedCenterChiefId
          : String(req.body?.center_chief_id || "").trim();
        const agendaNames = normalizeAgendaNames(req.body?.research_agendas);
        const joinedAgenda = agendaNames.join("; ");
        if (!codeRaw)
          return badRequest(res, "Research center code is required.");
        if (!centerChiefId) {
          return badRequest(res, "Center chief is required.");
        }
        if (
          isScopedChief &&
          String(req.body?.center_chief_id || "").trim() &&
          String(req.body?.center_chief_id || "").trim() !== savedCenterChiefId
        ) {
          return res.status(403).json({
            error: "Center Chiefs cannot reassign Research Center leadership.",
          });
        }

        let centerChiefName = "";
        let centerChiefUsername = "";
        let selectedCenterChief = null;
        {
          const users = await listUsers();
          const selected = (users || []).find(
            (row) => String(row?.id || "") === centerChiefId,
          );
          selectedCenterChief = selected || null;
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
            key !== "center_chief_id" &&
            key !== "center_chief_name" &&
            key !== "research_agendas" &&
            key !== "research_agenda" &&
            key !== "social_media_link"
          );
        });

        nextExtras.push({ key: "code", value: codeRaw });
        nextExtras.push({ key: "center_chief_id", value: centerChiefId });
        nextExtras.push({
          key: "center_chief_name",
          value: centerChiefName || centerChiefUsername,
        });
        if (joinedAgenda) {
          nextExtras.push({ key: "research_agendas", value: joinedAgenda });
        }
        if (socialMediaLink) {
          nextExtras.push({
            key: "social_media_link",
            value: socialMediaLink,
          });
        }

        const updated = await updateOrganizationMetadata({
          orgId: id,
          title: name || currentOrg?.title || currentOrg?.display_name || id,
          description,
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

        await syncLocalCenterChiefProfile(
          selectedCenterChief,
          updated || { name: id, id },
        );

        return res.json({
          data: {
            id: updated?.name || updated?.id || id,
            name:
              updated?.title || updated?.display_name || updated?.name || id,
            code: codeRaw,
            center_chief_id: centerChiefId || null,
            center_chief_name: centerChiefName || null,
            description:
              description || String(updated?.description || "").trim() || null,
            research_agendas: agendaNames,
            social_media_link: socialMediaLink || null,
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
        if (type === "proponent") {
          if (!ensureAdminOnly(res, req.user)) return;
          const updated = await updateUser(id, { is_active: false });
          if (!updated) {
            return res.status(404).json({ error: "Proponent was not found." });
          }
          return res.json({ data: { id, deleted: true, type } });
        }

        if (type === "department") {
          if (!ensureDepartmentScope(res, req.user, id)) return;
          const [members, datasets, departmentGroup] = await Promise.all([
            listGroupMembers(id),
            listAllDatasetsAcrossCkan(),
            getGroup(id),
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

          const chairpersonId = String(
            getExtraValue(departmentGroup, "chairperson_id") || "",
          ).trim();
          const activeMembers = (members || []).filter(
            (member) =>
              String(member?.state || "active").toLowerCase() !== "deleted",
          );
          const nonAdminMembers = activeMembers.filter((member) => {
            const memberId = String(member?.id || "").trim();
            const capacity = String(member?.capacity || "")
              .trim()
              .toLowerCase();
            if (chairpersonId && memberId === chairpersonId) return false;
            return capacity !== "admin";
          });

          if (nonAdminMembers.length) {
            return res.status(409).json({
              error:
                "Department cannot be deleted while it still has linked affiliates.",
              details: {
                linkedAffiliates: nonAdminMembers.length,
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
          if (!ensureCenterScope(res, req.user, id)) return;
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

          const activeMembers = (members || []).filter(
            (member) =>
              String(member?.state || "active").toLowerCase() !== "deleted",
          );
          const nonAdminMembers = activeMembers.filter(
            (member) =>
              String(member?.capacity || "")
                .trim()
                .toLowerCase() !== "admin",
          );

          if (nonAdminMembers.length) {
            return res.status(409).json({
              error:
                "Research center cannot be deleted while it still has linked affiliates.",
              details: {
                linkedAffiliates: nonAdminMembers.length,
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
