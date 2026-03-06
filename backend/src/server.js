import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { assertConfig, config } from "./config.js";
import { importLegacyUsersJsonIfNeeded, runMigrations } from "./migrations.js";
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
} from "./ckanClient.js";
import { ROLE_PERMISSIONS } from "./rolePermissions.js";
import {
  createUser,
  ensureDefaultAdmin,
  findUserByEmail,
  findUserById,
  hashPassword,
  toAuthPayload,
  updateUser,
  verifyPassword,
} from "./userStore.js";
import {
  forgotPasswordSchema,
  loginSchema,
  parseOrThrow,
  registerSchema,
  resetPasswordSchema,
} from "./validation.js";
import { createRateLimiter } from "./rateLimit.js";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
} from "./passwordResetStore.js";
import { logAuditEvent } from "./auditStore.js";

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

function toCkanName(value) {
  const base = asTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (base) return base;
  return `dataset-${Date.now()}`;
}

function formatOutputResourceName(row, index) {
  const outputType = asTrimmedString(row?.output_type || row?.outputType);
  const targetCount = Math.max(
    1,
    Number(row?.target_count || row?.targetCount || 1) || 1,
  );
  if (outputType) return `${outputType} (Target: ${targetCount})`;
  return `Expected Output ${index + 1}`;
}

function toDatasetExtras(form = {}, user = null) {
  const submittedAt = new Date().toISOString();
  const traceId = crypto.randomUUID();
  return [
    { key: "submitted_by_user_id", value: asTrimmedString(user?.id) || null },
    { key: "submitted_by_email", value: asTrimmedString(user?.email) || null },
    {
      key: "submitted_by_name",
      value: asTrimmedString(user?.full_name) || null,
    },
    { key: "submitted_by_role", value: asTrimmedString(user?.role) || null },
    { key: "submitted_at", value: submittedAt },
    { key: "submission_trace_id", value: traceId },
    {
      key: "lead_researcher",
      value: asTrimmedString(form.lead_researcher) || null,
    },
    { key: "faculty_team", value: asTrimmedString(form.faculty_team) || null },
    { key: "student_team", value: asTrimmedString(form.student_team) || null },
    { key: "project_year", value: asTrimmedString(form.year) || null },
    {
      key: "department_id",
      value: asTrimmedString(form.department_id) || null,
    },
    {
      key: "research_agenda_id",
      value: asTrimmedString(form.research_agenda_id) || null,
    },
    {
      key: "scholarly_type",
      value: asTrimmedString(form.scholarly_type) || null,
    },
    { key: "funding_type", value: asTrimmedString(form.funding_type) || null },
    {
      key: "funding_category",
      value: asTrimmedString(form.funding_category) || null,
    },
    {
      key: "industry_partner",
      value: asTrimmedString(form.industry_partner) || null,
    },
    {
      key: "funding_source",
      value: asTrimmedString(form.funding_source) || null,
    },
    {
      key: "funding_amount",
      value: String(asNumber(form.funding_amount, 0)),
    },
    {
      key: "classification",
      value: asTrimmedString(form.classification) || null,
    },
    { key: "project_status", value: asTrimmedString(form.status) || null },
    {
      key: "expected_outputs_summary",
      value: asTrimmedString(form.expected_outputs) || null,
    },
    {
      key: "supporting_mov_link",
      value: asTrimmedString(form.supporting_mov_link) || null,
    },
    {
      key: "signed_moa_reference",
      value: asTrimmedString(form.signed_moa_reference) || null,
    },
    { key: "start_date", value: asTrimmedString(form.start_date) || null },
    { key: "end_date", value: asTrimmedString(form.end_date) || null },
  ].filter((item) => item.value != null && item.value !== "");
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

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "arms-backend" });
});

app.post("/api/auth/register", registerRateLimit, async (req, res) => {
  try {
    const parsed = parseOrThrow(
      registerSchema,
      req.body,
      "Invalid registration payload.",
    );

    const full_name = parsed.full_name.trim();
    const email = parsed.email.trim().toLowerCase();
    const password = parsed.password;
    const role = normalizeRole(parsed.role);
    const department = String(parsed.department || "").trim();
    const ckan_org_id = String(parsed.ckan_org_id || "").trim();
    const ckan_group_id = String(
      parsed.ckan_group_id || department || "",
    ).trim();

    if (role === "admin") {
      return badRequest(res, "Admin role cannot be self-registered.");
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      await logAuditEvent({
        eventType: "auth.register_conflict",
        details: { email },
      });
      return res.status(409).json({ error: "Email is already registered." });
    }

    const [orgs, groups] = await Promise.all([
      listOrganizations(),
      listGroups(),
    ]);
    const selectedOrg = byAnyId(orgs, ckan_org_id);
    if (!selectedOrg) {
      return badRequest(res, "Selected CKAN organization was not found.");
    }

    let selectedGroup = null;
    if (ckan_group_id) {
      selectedGroup = byAnyId(groups, ckan_group_id);
      if (!selectedGroup) {
        return badRequest(res, "Selected CKAN group/department was not found.");
      }
    }

    const ckanUser = await createOrGetUser({
      email,
      fullName: full_name,
      password,
    });

    await assignUserToOrganizationEditor({
      orgId: selectedOrg.name || selectedOrg.id,
      username: ckanUser.name,
    });

    if (selectedGroup) {
      await assignUserToGroupEditor({
        groupId: selectedGroup.name || selectedGroup.id,
        username: ckanUser.name,
      });
    }

    const password_hash = await hashPassword(password);
    const created = await createUser({
      full_name,
      email,
      password_hash,
      role,
      department:
        selectedGroup?.title ||
        selectedGroup?.display_name ||
        selectedGroup?.name ||
        department ||
        null,
      ckan_org_id: selectedOrg.name || selectedOrg.id,
      ckan_group_id: selectedGroup?.name || selectedGroup?.id || null,
      ckan_username: ckanUser.name,
      ckan_user_id: ckanUser.id || null,
    });

    await logAuditEvent({
      actorUserId: created.id,
      eventType: "auth.register_success",
      details: {
        email: created.email,
        role: created.role,
        ckan_org_id: created.ckan_org_id,
        ckan_group_id: created.ckan_group_id,
      },
    });

    return res.status(201).json({ ok: true });
  } catch (error) {
    await logAuditEvent({
      eventType: "auth.register_failed",
      details: { message: String(error?.message || "Registration failed.") },
    });
    return res
      .status(500)
      .json({ error: String(error?.message || "Registration failed.") });
  }
});

app.post("/api/auth/login", loginRateLimit, async (req, res) => {
  try {
    const parsed = parseOrThrow(
      loginSchema,
      req.body,
      "Invalid login payload.",
    );
    const email = parsed.email.trim().toLowerCase();
    const password = parsed.password;

    const user = await findUserByEmail(email);
    if (!user) {
      await logAuditEvent({
        eventType: "auth.login_failed",
        details: { email, reason: "user_not_found" },
      });
      return unauthorized(res, "Invalid email or password.");
    }
    if (user.is_active === false) {
      await logAuditEvent({
        actorUserId: user.id,
        eventType: "auth.login_blocked",
        details: { reason: "inactive" },
      });
      return unauthorized(res, "Account is deactivated.");
    }

    const ok = await verifyPassword(user, password);
    if (!ok) {
      await logAuditEvent({
        actorUserId: user.id,
        eventType: "auth.login_failed",
        details: { reason: "bad_password" },
      });
      return unauthorized(res, "Invalid email or password.");
    }

    if (user.ckan_username) {
      try {
        const tokenResult = await createApiTokenForUser(user.ckan_username);
        await updateUser(user.id, {
          ckan_api_token: tokenResult?.token || null,
          ckan_api_token_created_at: new Date().toISOString(),
        });
        await logAuditEvent({
          actorUserId: user.id,
          eventType: "ckan.api_token_generated",
          details: {
            ckan_username: user.ckan_username,
            token_id: tokenResult?.id || null,
          },
        });
      } catch (error) {
        await logAuditEvent({
          actorUserId: user.id,
          eventType: "ckan.api_token_generation_failed",
          details: { message: String(error?.message || "Unknown error") },
        });
      }
    }

    const latest = (await findUserById(user.id)) || user;
    const token = signSession(latest);

    await logAuditEvent({
      actorUserId: user.id,
      eventType: "auth.login_success",
      details: { email: user.email },
    });

    return res.json(toAuthPayload(latest, token));
  } catch (error) {
    return res
      .status(500)
      .json({ error: String(error?.message || "Login failed.") });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  return res.json(toAuthPayload(req.user, null));
});

app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  await logAuditEvent({
    actorUserId: req.user.id,
    eventType: "auth.logout",
    details: { email: req.user.email },
  });
  return res.json({ ok: true });
});

app.post("/api/auth/forgot-password", forgotRateLimit, async (req, res) => {
  try {
    const parsed = parseOrThrow(
      forgotPasswordSchema,
      req.body,
      "Invalid forgot-password payload.",
    );
    const email = parsed.email.trim().toLowerCase();
    const user = await findUserByEmail(email);

    if (!user || user.is_active === false) {
      await logAuditEvent({
        eventType: "auth.forgot_password_ignored",
        details: { email },
      });
      return res.json({ ok: true });
    }

    const token = await createPasswordResetToken(
      user.id,
      config.resetTokenTtlMinutes,
    );

    await logAuditEvent({
      actorUserId: user.id,
      eventType: "auth.forgot_password_requested",
      details: { email: user.email },
    });

    const payload = { ok: true };
    if (config.nodeEnv !== "production" && config.exposeResetTokenInResponse) {
      payload.reset_token = token;
    }

    return res.json(payload);
  } catch (error) {
    return res
      .status(500)
      .json({ error: String(error?.message || "Forgot password failed.") });
  }
});

app.post("/api/auth/reset-password", resetRateLimit, async (req, res) => {
  try {
    const parsed = parseOrThrow(
      resetPasswordSchema,
      req.body,
      "Invalid reset-password payload.",
    );

    const consumed = await consumePasswordResetToken(parsed.token);
    if (!consumed) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    const user = await findUserById(consumed.user_id);
    if (!user || user.is_active === false) {
      return res
        .status(400)
        .json({ error: "Account is not eligible for reset." });
    }

    const password_hash = await hashPassword(parsed.password);
    await updateUser(user.id, { password_hash });

    if (user.ckan_username) {
      try {
        await updateCkanUserPassword(user.ckan_username, parsed.password);
        await logAuditEvent({
          actorUserId: user.id,
          eventType: "ckan.password_sync_success",
          details: { ckan_username: user.ckan_username },
        });
      } catch (error) {
        await logAuditEvent({
          actorUserId: user.id,
          eventType: "ckan.password_sync_failed",
          details: {
            ckan_username: user.ckan_username,
            message: String(error?.message || "Unknown error"),
          },
        });
      }
    }

    await logAuditEvent({
      actorUserId: user.id,
      eventType: "auth.password_reset_completed",
      details: { email: user.email },
    });

    return res.json({ ok: true });
  } catch (error) {
    return res
      .status(500)
      .json({ error: String(error?.message || "Reset password failed.") });
  }
});

app.get("/api/permissions/role-map", authMiddleware, (req, res) => {
  return res.json({ map: ROLE_PERMISSIONS });
});

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
    return res
      .status(500)
      .json({ error: String(error?.message || "Failed to load CKAN users.") });
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
        error: String(error?.message || "Failed to load organization agendas."),
      });
    }
  },
);

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

app.get(
  "/api/submissions/mine/research-outputs",
  authMiddleware,
  async (req, res) => {
    try {
      const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
      const orgId = isAdmin ? "" : asTrimmedString(req.user?.ckan_org_id);
      const page = Math.max(1, Number(req.query?.page || 1));
      const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 100)));
      const q = asTrimmedString(req.query?.q || "");

      const result = await listDatasets({ orgId, q, page, limit });
      const datasets = Array.isArray(result?.datasets) ? result.datasets : [];
      const rows = [];

      for (const dataset of datasets) {
        const resources = Array.isArray(dataset?.resources)
          ? dataset.resources
          : [];
        const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
        const projectStatus =
          getExtraByKey(extras, "project_status") ||
          getExtraByKey(extras, "status") ||
          dataset?.state ||
          null;

        for (const resource of resources) {
          rows.push({
            id: resource?.id || `${dataset?.id || dataset?.name}-resource`,
            output_type: String(resource?.format || "resource")
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_"),
            file_name: resource?.name || null,
            file_path: resource?.url || null,
            mime_type: resource?.mimetype || resource?.format || null,
            file_size: resource?.size || null,
            notes: resource?.description || null,
            ckan_resource_id: resource?.id || null,
            ckan_dataset_id: dataset?.id || null,
            ckan_dataset_name: dataset?.title || dataset?.name || null,
            project_title: dataset?.title || dataset?.name || null,
            project_ckan_org_id:
              dataset?.organization?.name || dataset?.owner_org || null,
            project_org_name:
              dataset?.organization?.title ||
              dataset?.organization?.display_name ||
              dataset?.organization?.name ||
              dataset?.owner_org ||
              null,
            project_public_visible: !Boolean(dataset?.private),
            project_status: projectStatus,
            ckan_sync_status: dataset?.state || null,
            ckan_last_synced_at:
              resource?.last_modified ||
              dataset?.metadata_modified ||
              dataset?.metadata_created ||
              null,
            created_at: resource?.created || dataset?.metadata_created || null,
            updated_at:
              resource?.last_modified ||
              dataset?.metadata_modified ||
              dataset?.metadata_created ||
              null,
          });
        }
      }

      return res.json({ data: rows });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load research outputs."),
      });
    }
  },
);

app.post("/api/submissions/publish", authMiddleware, async (req, res) => {
  const form = req.body?.form || {};
  const expectedOutputs = Array.isArray(req.body?.expected_outputs)
    ? req.body.expected_outputs
    : [];
  const datasetId = asTrimmedString(req.body?.dataset_id);

  const title = asTrimmedString(form.title);
  if (!title) return badRequest(res, "Project title is required.");

  const ownerOrg =
    asTrimmedString(form.research_center_id) ||
    asTrimmedString(req.user?.ckan_org_id);
  if (!ownerOrg) {
    return badRequest(res, "Research center (CKAN organization) is required.");
  }

  const notes = asTrimmedString(form.abstract);
  const supportingMovLink = asTrimmedString(form.supporting_mov_link);
  const fallbackResourceUrl =
    supportingMovLink || `${config.ckanBaseUrl}/dataset`;

  const baseDatasetPayload = {
    name: toCkanName(title),
    title,
    notes,
    owner_org: ownerOrg,
    author:
      asTrimmedString(req.user?.full_name) ||
      asTrimmedString(req.user?.email) ||
      null,
    author_email: asTrimmedString(req.user?.email) || null,
    maintainer:
      asTrimmedString(req.user?.full_name) ||
      asTrimmedString(req.user?.email) ||
      null,
    maintainer_email: asTrimmedString(req.user?.email) || null,
    // Business rule: all submitted project datasets start as private in CKAN.
    private: true,
    tags: [
      asTrimmedString(form.classification),
      asTrimmedString(form.status),
      asTrimmedString(form.scholarly_type),
    ]
      .filter(Boolean)
      .map((value) => ({
        name: value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      })),
    extras: toDatasetExtras(form, req.user),
  };

  let dataset = null;
  const createdNow = !datasetId;
  try {
    dataset = datasetId
      ? await updateDataset({ ...baseDatasetPayload, id: datasetId })
      : await createDataset(baseDatasetPayload);

    const createdResources = [];
    for (let i = 0; i < expectedOutputs.length; i += 1) {
      const row = expectedOutputs[i] || {};
      const name = formatOutputResourceName(row, i);
      const description = asTrimmedString(row.notes);
      const fileName =
        asTrimmedString(row.file_name) || asTrimmedString(row.fileName) || "";
      const filePath =
        asTrimmedString(row.file_path) || asTrimmedString(row.filePath) || "";
      const url =
        /^https?:\/\//i.test(filePath) || String(filePath).startsWith("blob:")
          ? filePath
          : fallbackResourceUrl;
      const format = fileName.includes(".")
        ? fileName.split(".").pop()?.toUpperCase() || ""
        : "";

      const resource = await createDatasetResource({
        package_id: dataset.id || dataset.name,
        name,
        description: description || null,
        url,
        format: format || null,
      });
      createdResources.push(resource);
    }

    return res.status(createdNow ? 201 : 200).json({
      data: {
        id: dataset.id,
        name: dataset.name,
        title: dataset.title,
        owner_org: dataset.owner_org,
        resources_created: createdResources.length,
      },
    });
  } catch (error) {
    if (createdNow && dataset?.id) {
      try {
        await deleteDataset(dataset.id);
      } catch {
        // Best-effort cleanup only.
      }
    }
    return res.status(500).json({
      error: String(error?.message || "Failed to publish dataset to CKAN."),
    });
  }
});

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

function toBool(value, fallback = false) {
  if (value == null) return fallback;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(text)) return true;
  if (["false", "0", "no", "n"].includes(text)) return false;
  return fallback;
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

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
    const [centers, groups, ckanUsers] = await Promise.all([
      listOrganizations(),
      listGroups(),
      listUsers(),
    ]);

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
          publication_count: toInt(
            getUserExtraValue(user, "publication_count"),
            0,
          ),
          research_project_count: toInt(
            getUserExtraValue(user, "research_project_count"),
            0,
          ),
          creative_work_count: toInt(
            getUserExtraValue(user, "creative_work_count"),
            0,
          ),
          awards_count: toInt(getUserExtraValue(user, "awards_count"), 0),
          ip_count: toInt(getUserExtraValue(user, "ip_count"), 0),
          created_at: user?.created || null,
          updated_at: user?.activity_streams_email_notifications || null,
        };
      });

    return res.json({
      rows,
      centers: (centers || []).map((center) => ({
        id: center?.name || center?.id,
        name: center?.title || center?.display_name || center?.name || "-",
      })),
      ckan_user_mode: "enabled",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: String(error?.message || "Failed to load affiliates.") });
  }
});

app.patch("/api/admin/affiliates/:userId", authMiddleware, async (req, res) => {
  return res.status(501).json({
    error:
      "CKAN-sourced affiliate records are read-only in this page. Update user details directly in CKAN.",
  });
});

app.get(
  "/api/admin/controls/reference-data",
  authMiddleware,
  async (req, res) => {
    try {
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
          .filter((row) => String(row?.state || "").toLowerCase() !== "deleted")
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
        error: String(error?.message || "Failed to load admin reference data."),
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
      if (type !== "center" || !id) {
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

      const [members, datasets] = await Promise.all([
        listOrganizationMembers(id),
        listDatasets({ orgId: id, page: 1, limit: 1 }),
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
        projectCount: Number(datasets?.count || 0),
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
            agenda_name: agendaId ? agendaNameById[agendaId] || agendaId : null,
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
      if (type !== "center") {
        return res.status(501).json({
          error: "Only center create is implemented in this backend.",
        });
      }

      const name = String(req.body?.name || "").trim();
      const codeRaw = String(req.body?.code || "").trim();
      const centerChiefId = String(req.body?.center_chief_id || "").trim();
      const agendaNames = normalizeAgendaNames(req.body?.research_agendas);
      if (!name) return badRequest(res, "Research center name is required.");
      if (!codeRaw) return badRequest(res, "Research center code is required.");
      if (!centerChiefId) {
        return badRequest(res, "Center chief is required.");
      }

      const orgName = codeRaw.toLowerCase().replace(/[^a-z0-9_\-]+/g, "-");
      if (!orgName) return badRequest(res, "Research center code is invalid.");

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
      return res
        .status(500)
        .json({ error: String(error?.message || "Reference create failed.") });
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
      if (type !== "center") {
        return res.status(501).json({
          error: "Only center update is implemented in this backend.",
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
      if (!codeRaw) return badRequest(res, "Research center code is required.");

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

        if (
          previousAdminUsername &&
          previousAdminUsername.toLowerCase() !==
            centerChiefUsername.toLowerCase()
        ) {
          await setOrganizationMemberRole({
            orgId: targetOrgId,
            username: previousAdminUsername,
            role: "editor",
          });
        }

        await setOrganizationMemberRole({
          orgId: targetOrgId,
          username: centerChiefUsername,
          role: "admin",
        });
      }

      return res.json({
        data: {
          id: updated?.name || updated?.id || id,
          name: updated?.title || updated?.display_name || updated?.name || id,
          code: codeRaw,
          center_chief_id: centerChiefId || null,
          center_chief_name: centerChiefName || null,
          research_agendas: agendaNames,
        },
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: String(error?.message || "Reference update failed.") });
    }
  },
);

app.delete(
  "/api/admin/controls/reference/:type/:id",
  authMiddleware,
  async (req, res) => {
    return res.status(501).json({
      error: "Reference delete is not implemented in this backend yet.",
    });
  },
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(config.port, () => {
  console.log(`ARMS backend listening on http://localhost:${config.port}`);
});
