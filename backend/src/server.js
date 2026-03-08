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
  assignUserToOrganizationAdmin,
  assignUserToOrganizationEditor,
  createOrganization,
  createDataset,
  createDatasetResource,
  createApiTokenForUser,
  createOrGetUser,
  deleteOrganization,
  deleteDataset,
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
  forgotPasswordSchema,
  loginSchema,
  parseOrThrow,
  registerSchema,
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

if (!config.ckanVerifyTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

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
app.use(express.json());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function unauthorized(res, message = "Unauthorized") {
  return res.status(401).json({ error: message });
}

function signSession(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: crypto.randomUUID(),
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

async function authMiddleware(req, res, next) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return unauthorized(res);

  const token = header.slice("Bearer ".length).trim();
  if (!token) return unauthorized(res);

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await findUserById(payload.sub);
    if (!user || user.is_active === false) return unauthorized(res);
    req.user = user;
    req.auth = payload;
    return next();
  } catch {
    return unauthorized(res);
  }
}

function normalizeRole(role) {
  const value = String(role || "student").toLowerCase();
  return value === "faculty"
    ? "faculty"
    : value === "admin"
      ? "admin"
      : "student";
}

function asTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function isDatasetOwnedByUser(dataset, user) {
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

function inferOutputTypeFromResource(resource) {
  const fromName = normalizeOutputType(resource?.name || "");
  if (fromName) return fromName;
  const fromDescription = normalizeOutputType(resource?.description || "");
  if (fromDescription) return fromDescription;
  const fromFormat = normalizeOutputType(resource?.format || "");
  if (fromFormat) return fromFormat;
  return "";
}

async function listOwnedDatasets(user) {
  const role = String(user?.role || "").toLowerCase();
  const orgId =
    role === "admin" ? "" : asTrimmedString(user?.ckan_org_id || "");
  if (role !== "admin" && !orgId) return [];

  const rows = [];
  const limit = 100;
  let page = 1;

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

function requestIdentity(req) {
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

registerAuthRoutes(app, {
  registerRateLimit,
  loginRateLimit,
  forgotRateLimit,
  resetRateLimit,
  authMiddleware,
  parseOrThrow,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
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
  signSession,
  createApiTokenForUser,
  updateCkanUserPassword,
  createPasswordResetToken,
  consumePasswordResetToken,
  logAuditEvent,
});

registerProfileRoutes(app, {
  authMiddleware,
  parseOrThrow,
  affiliateProfileUpdateSchema,
  updateUser,
  findUserById,
  computeAffiliateProfileMetrics,
});

registerCkanIntegrationRoutes(app, {
  authMiddleware,
  listOrganizations,
  listGroups,
  listOrganizationMembers,
  listUsers,
  listDatasets,
  listOrganizationAgendas,
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
  config,
  asTrimmedString,
  asNumber,
  listDatasets,
  createDataset,
  updateDataset,
  deleteDataset,
  createDatasetResource,
  getExtraByKey,
});

registerAdminRoutes(app, {
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
  deleteOrganization,
  assignUserToOrganizationAdmin,
  getOrganization,
  updateOrganizationMetadata,
  setOrganizationMemberRole,
});

registerAdminUserRoutes(app, {
  authMiddleware,
  ROLE_PERMISSIONS,
  listDatasets,
  updateUser,
  setOrganizationMemberRole,
  logAuditEvent,
});
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(config.port, () => {
  console.log(`ARMS backend listening on http://localhost:${config.port}`);
});

