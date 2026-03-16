import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { assertConfig, config } from "./config/index.js";
import {
  importLegacyUsersJsonIfNeeded,
  runMigrations,
} from "./db/migrations.js";
import {
  assignUserToGroupEditor,
  assignUserToGroupAdmin,
  createGroup,
  deleteGroup,
  assignUserToOrganizationAdmin,
  assignUserToOrganizationEditor,
  removeUserFromGroup,
  setGroupMemberRole,
  removeUserFromOrganization,
  createOrganization,
  createDataset,
  createDatasetResource,
  createDatasetResourceUpload,
  updateDatasetResource,
  deleteDatasetResource,
  createApiTokenForUser,
  createOrGetUser,
  deleteOrganization,
  deleteDataset,
  getDataset,
  getGroup,
  getOrganization,
  listDatasets,
  listGroupMembers,
  listGroups,
  listOrganizationAgendas,
  listOrganizationMembers,
  listOrganizations,
  listUsers,
  setOrganizationMemberRole,
  updateDataset,
  updateGroupMetadata,
  updateGroupMetadataWithDescription,
  setDatasetVisibility,
  updateOrganizationMetadata,
  updateCkanUserPassword,
} from "./integrations/ckan/client.js";
import { ROLE_PERMISSIONS } from "./security/rolePermissions.js";
import {
  createUser,
  ensureDefaultAdmin,
  findUserByEmail,
  findUserById,
  hashPassword,
  toAuthPayload,
  updateUser,
  verifyPassword,
} from "./stores/user.store.js";
import {
  affiliateProfileUpdateSchema,
  adminCreateProponentSchema,
  awardRecognitionSchema,
  forgotPasswordSchema,
  loginSchema,
  parseOrThrow,
  projectSubmissionDraftSchema,
  projectSubmissionPublishSchema,
  registerSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "./validation/schemas.js";
import { createRateLimiter } from "./security/rateLimit.js";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
} from "./stores/passwordReset.store.js";
import { logAuditEvent } from "./stores/audit.store.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerProfileRoutes } from "./modules/profile/profile.routes.js";
import { registerCkanIntegrationRoutes } from "./modules/integrations/ckan.routes.js";
import { registerReferenceRoutes } from "./modules/reference/reference.routes.js";
import { registerDashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { registerSubmissionsRoutes } from "./modules/submissions/submissions.routes.js";
import { registerAdminRoutes } from "./modules/admin/admin.routes.js";
import { registerAdminUserRoutes } from "./modules/admin/users.routes.js";
import { registerAwardsRoutes } from "./modules/awards/awards.routes.js";

// Startup flow:
// 1) Validate required environment configuration.
// 2) Ensure schema is up to date.
// 3) Optionally import legacy bootstrap data.
// 4) Ensure a default admin exists for first login.
assertConfig();
await runMigrations();
const importSummary = await importLegacyUsersJsonIfNeeded();
if (importSummary.imported > 0) {
  console.log(
    `[DB] Imported ${importSummary.imported} user(s) from legacy JSON (${importSummary.reason}).`,
  );
}
await ensureDefaultAdmin();

const app = express();
app.use(express.json({ limit: "40mb" }));
app.use(
  cors({
    // CORS origins are centrally configured to match frontend hosts.
    origin: config.corsOrigins,
    credentials: true,
  }),
);

/**
 * Sends a standardized 400 response payload.
 *
 * Shared by route modules via dependency injection to keep error shape consistent.
 */
function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

/**
 * Sends a standardized 401 response payload.
 *
 * Used by auth middleware and auth handlers to avoid leaking internal failure details.
 */
function unauthorized(res, message = "Unauthorized") {
  return res.status(401).json({ error: message });
}

/**
 * Issues a JWT session token for an authenticated user.
 *
 * Payload fields:
 * - `sub`: user id (primary identity for auth middleware lookup).
 * - `email`, `role`: convenience claims used by clients.
 * - `sid`: per-session identifier for auditing/revocation strategies.
 */
function signSession(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      // Unique session id supports revocation/audit patterns even for same user.
      sid: crypto.randomUUID(),
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function parseCookies(headerValue) {
  const pairs = String(headerValue || "")
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const cookies = {};
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.split("=");
    const name = String(rawName || "").trim();
    if (!name) continue;
    cookies[name] = decodeURIComponent(rest.join("=") || "");
  }
  return cookies;
}

function buildSessionCookie(value, maxAgeSeconds = null) {
  const parts = [
    `${config.authCookieName}=${encodeURIComponent(String(value || ""))}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (config.authCookieSecure) {
    parts.push("Secure");
  }
  if (Number.isFinite(maxAgeSeconds)) {
    parts.push(`Max-Age=${Math.max(0, Math.trunc(maxAgeSeconds))}`);
  }
  return parts.join("; ");
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", buildSessionCookie(token));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", buildSessionCookie("", 0));
}

async function resolveCenterChiefContext(user) {
  const base = {
    ...(user || {}),
    is_center_chief: false,
    managed_center_id: null,
    managed_center_name: null,
  };
  if (!user || String(user?.role || "").trim().toLowerCase() !== "faculty") {
    return base;
  }

  const candidateIds = new Set(
    [user?.ckan_user_id, user?.id]
      .map((value) => asTrimmedString(value))
      .filter(Boolean),
  );
  if (candidateIds.size === 0) return base;

  try {
    const organizations = await listOrganizations();
    const managedCenter = (organizations || []).find((organization) => {
      const chiefId = asTrimmedString(
        getExtraByKey(organization?.extras, "center_chief_id"),
      );
      return chiefId && candidateIds.has(chiefId);
    });
    if (!managedCenter) return base;

    return {
      ...base,
      is_center_chief: true,
      managed_center_id: managedCenter?.name || managedCenter?.id || null,
      managed_center_name:
        managedCenter?.title ||
        managedCenter?.display_name ||
        managedCenter?.name ||
        null,
    };
  } catch {
    return base;
  }
}

/**
 * Authenticates requests using either bearer tokens or the session cookie.
 *
 * System flow:
 * - Validate bearer token format.
 * - Verify JWT signature and expiry.
 * - Resolve current user from DB.
 * - Reject deactivated/missing users even if token is valid.
 *
 * Side effects:
 * - Attaches `req.user` and `req.auth` on success.
 */
async function authMiddleware(req, res, next) {
  const header = String(req.headers.authorization || "");
  const bearerToken = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
  const cookieToken =
    parseCookies(req.headers.cookie || "")[config.authCookieName] || "";
  const token = bearerToken || cookieToken;
  if (!token) return unauthorized(res);

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await findUserById(payload.sub);
    if (!user || user.is_active === false) return unauthorized(res);
    req.user = await resolveCenterChiefContext(user);
    req.auth = payload;
    return next();
  } catch {
    return unauthorized(res);
  }
}

/**
 * Normalizes incoming role values to supported role enum.
 *
 * Data transformation:
 * - Accepts arbitrary role input.
 * - Returns one of: `student`, `faculty`, `admin`.
 */
function normalizeRole(role) {
  const value = String(role || "student").toLowerCase();
  return value === "faculty"
    ? "faculty"
    : value === "admin"
      ? "admin"
      : "student";
}

/**
 * Normalizes arbitrary input to a trimmed string.
 *
 * Utility used throughout route modules to reduce null/undefined branching.
 */
function asTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Coerces input into number with fallback.
 *
 * Edge case:
 * - Non-finite values (`NaN`, `Infinity`) resolve to provided fallback.
 */
function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalizes resource/output type labels into canonical buckets.
 *
 * Important logic:
 * - Removes "(Target: n)" suffix pattern used in submission-generated labels.
 * - Normalizes separators/casing.
 * - Maps known synonyms to canonical values consumed by metrics.
 */
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
  if (["award", "awards", "recognition"].includes(base)) {
    return "award";
  }
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

/**
 * Retrieves an `extras` metadata value by case-insensitive key.
 *
 * Used by dataset ownership and project metadata extraction paths.
 */
function getExtraByKey(extras, key) {
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

/**
 * Determines whether a dataset belongs to the provided user.
 *
 * Important logic:
 * - Checks current and historical ownership markers:
 *   `submitted_by_user_id`, `submitted_by_email`, `submitted_by`.
 * - Falls back to `author_email` for older datasets.
 *
 * Edge case:
 * - Ownership checks are resilient to mixed casing/whitespace in metadata.
 */
function isDatasetOwnedByUser(dataset, user) {
  // Ownership is inferred from multiple legacy metadata fields for backward compatibility.
  const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
  const submittedByUserId = asTrimmedString(
    getExtraByKey(extras, "submitted_by_user_id"),
  );
  const submittedByEmail = asTrimmedString(
    getExtraByKey(extras, "submitted_by_email"),
  ).toLowerCase();
  const submittedBy = asTrimmedString(getExtraByKey(extras, "submitted_by"));
  const userId = asTrimmedString(user?.id);
  const userEmail = asTrimmedString(user?.email).toLowerCase();

  if (submittedByUserId && userId && submittedByUserId === userId) return true;
  if (submittedByEmail && userEmail && submittedByEmail === userEmail) {
    return true;
  }
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
 * Infers a normalized output type from a CKAN resource.
 *
 * System flow:
 * - Try resource name first, then description, then format.
 * - Return first canonical match from `normalizeOutputType`.
 */
function inferOutputTypeFromResource(resource) {
  const fromName = normalizeOutputType(resource?.name || "");
  if (fromName) return fromName;
  const fromDescription = normalizeOutputType(resource?.description || "");
  if (fromDescription) return fromDescription;
  const fromFormat = normalizeOutputType(resource?.format || "");
  if (fromFormat) return fromFormat;
  return "";
}

/**
 * Lists datasets owned by a user across CKAN pages.
 *
 * System flow:
 * - Non-admin users are scoped to their `ckan_org_id`.
 * - Admin users query across organizations.
 * - Filters each page by `isDatasetOwnedByUser`.
 *
 * Edge case:
 * - Hard page cap prevents runaway fetch loops when upstream totals are inaccurate.
 */
async function listOwnedDatasets(user) {
  const role = String(user?.role || "").toLowerCase();
  const orgId =
    role === "admin" ? "" : asTrimmedString(user?.ckan_org_id || "");
  if (role !== "admin" && !orgId) return [];

  const rows = [];
  const limit = 100;
  let page = 1;

  // Safety cap prevents runaway pagination if CKAN returns inconsistent totals.
  while (page <= 20) {
    const result = await listDatasets({ orgId, page, limit });
    const datasets = Array.isArray(result?.datasets) ? result.datasets : [];
    if (!datasets.length) break;

    rows.push(
      ...datasets.filter((dataset) => isDatasetOwnedByUser(dataset, user)),
    );
    const total = Number(result?.count || 0);
    if (datasets.length < limit || (page * limit >= total && total > 0)) break;
    page += 1;
  }

  return rows;
}

/**
 * Computes affiliate profile counters from owned datasets/resources.
 *
 * Data transformation:
 * - `research_project_count` = owned dataset count.
 * - Resource-level outputs are categorized into publication/creative/award/IP counts.
 *
 * Dependency:
 * - Relies on `listOwnedDatasets` + `inferOutputTypeFromResource`.
 */
async function computeAffiliateProfileMetrics(user) {
  const ownedDatasets = await listOwnedDatasets(user);
  let publicationCount = 0;
  let creativeWorkCount = 0;
  let awardsCount = 0;
  let ipCount = 0;

  for (const dataset of ownedDatasets) {
    const resources = Array.isArray(dataset?.resources)
      ? dataset.resources
      : [];
    for (const resource of resources) {
      const outputType = inferOutputTypeFromResource(resource);
      if (outputType === "publication") publicationCount += 1;
      if (outputType === "creative_work") creativeWorkCount += 1;
      if (outputType === "award") awardsCount += 1;
      if (outputType === "patent_ip") ipCount += 1;
    }
  }

  return {
    publication_count: publicationCount,
    research_project_count: ownedDatasets.length,
    creative_work_count: creativeWorkCount,
    awards_count: awardsCount,
    ip_count: ipCount,
  };
}

/**
 * Resolves an entity from CKAN rows by either `id` or `name`.
 *
 * Used for organization/group selection during registration where the client
 * may submit either identifier form.
 */
function byAnyId(rows, value) {
  const candidate = String(value || "")
    .trim()
    .toLowerCase();
  if (!candidate) return null;
  return (
    rows.find((row) => String(row?.id || "").toLowerCase() === candidate) ||
    rows.find((row) => String(row?.name || "").toLowerCase() === candidate)
  );
}

/**
 * Produces a stable requester identity key for rate limiting.
 *
 * Priority:
 * - First forwarded IP (proxy-aware), then socket/express IP fallback.
 */
function requestIdentity(req) {
  // Prefer the first forwarded IP when behind a proxy/load balancer.
  const ip =
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown";
  return ip;
}

const loginRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 12,
  // Per-email key reduces credential-stuffing impact against a single account.
  keyFn: (req) =>
    `${requestIdentity(req)}|${String(req.body?.email || "").toLowerCase()}`,
});

const registerRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
  keyFn: (req) => `${requestIdentity(req)}|register`,
});

const forgotRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyFn: (req) =>
    `${requestIdentity(req)}|forgot|${String(req.body?.email || "").toLowerCase()}`,
});

const resetRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  keyFn: (req) => `${requestIdentity(req)}|reset`,
});

const changePasswordRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  keyFn: (req) => `${requestIdentity(req)}|change|${String(req.user?.id || "anon")}`,
});

// Register module routes with explicit dependency injection.
// This keeps route files decoupled from direct imports and simplifies testing/mocking.
registerAuthRoutes(app, {
  registerRateLimit,
  loginRateLimit,
  forgotRateLimit,
  resetRateLimit,
  changePasswordRateLimit,
  authMiddleware,
  parseOrThrow,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  config,
  ROLE_PERMISSIONS,
  normalizeRole,
  badRequest,
  unauthorized,
  byAnyId,
  listOrganizations,
  listGroups,
  createOrGetUser,
  assignUserToOrganizationEditor,
  assignUserToGroupEditor,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  verifyPassword,
  hashPassword,
  toAuthPayload,
  resolveCenterChiefContext,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  createApiTokenForUser,
  updateCkanUserPassword,
  createPasswordResetToken,
  consumePasswordResetToken,
  logAuditEvent,
});

registerProfileRoutes(app, {
  authMiddleware,
  parseOrThrow,
  badRequest,
  affiliateProfileUpdateSchema,
  updateUser,
  findUserById,
  computeAffiliateProfileMetrics,
  listOrganizations,
  listGroups,
  byAnyId,
  assignUserToOrganizationEditor,
  assignUserToGroupEditor,
  assignUserToGroupAdmin,
  removeUserFromOrganization,
  removeUserFromGroup,
  setGroupMemberRole,
  logAuditEvent,
});

registerCkanIntegrationRoutes(app, {
  authMiddleware,
  listOrganizations,
  listGroups,
  listOrganizationMembers,
  listUsers,
  listDatasets,
  listOrganizationAgendas,
  findUserByEmail,
});

registerReferenceRoutes(app, {
  authMiddleware,
  listOrganizations,
  listGroups,
  listOrganizationAgendas,
});

registerDashboardRoutes(app, {
  authMiddleware,
  asTrimmedString,
  listDatasets,
  listGroups,
  listOrganizationAgendas,
});

registerSubmissionsRoutes(app, {
  authMiddleware,
  badRequest,
  parseOrThrow,
  projectSubmissionDraftSchema,
  projectSubmissionPublishSchema,
  config,
  asTrimmedString,
  asNumber,
  listDatasets,
  getDataset,
  createDataset,
  updateDataset,
  setDatasetVisibility,
  deleteDataset,
  createDatasetResource,
  createDatasetResourceUpload,
  updateDatasetResource,
  deleteDatasetResource,
  getExtraByKey,
});

registerAwardsRoutes(app, {
  authMiddleware,
  badRequest,
  parseOrThrow,
  awardRecognitionSchema,
  asTrimmedString,
  listDatasets,
  listOrganizations,
  getDataset,
  createDataset,
  updateDataset,
  deleteDataset,
  createDatasetResourceUpload,
  deleteDatasetResource,
  getExtraByKey,
  getGroup,
  byAnyId,
  listUsers,
  listOrganizationMembers,
  findUserByEmail,
});

registerAdminRoutes(app, {
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
});

registerAdminUserRoutes(app, {
  authMiddleware,
  ROLE_PERMISSIONS,
  parseOrThrow,
  adminCreateProponentSchema,
  listDatasets,
  updateUser,
  listOrganizations,
  listGroups,
  createOrGetUser,
  createUser,
  hashPassword,
  findUserByEmail,
  assignUserToOrganizationEditor,
  assignUserToGroupEditor,
  setOrganizationMemberRole,
  logAuditEvent,
});

/**
 * Final error middleware.
 *
 * Behavior:
 * - Logs error server-side.
 * - Returns generic 500 message to avoid leaking internals to clients.
 */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

/**
 * Starts the HTTP server on configured port.
 */
app.listen(config.port, () => {
  console.log(`ARMS backend listening on http://localhost:${config.port}`);
});

