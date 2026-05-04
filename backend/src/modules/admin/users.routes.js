import crypto from "node:crypto";
import {
  buildInviteSetPasswordEmailHtml,
  buildInviteSetPasswordEmailText,
  buildResetLink,
} from "../auth/auth.email.js";
import {
  getAdminUserDetail,
  listAdminUsers,
  updateAdminUserStatus,
} from "./users.service.js";

/**
 * Checks whether user role includes required permission.
 */
function hasPermission(user, permission, userHasPermission, ROLE_PERMISSIONS) {
  if (typeof userHasPermission === "function") {
    return userHasPermission(user, permission);
  }
  const directPermissions = Array.isArray(user?.permissions)
    ? user.permissions
    : [];
  if (directPermissions.includes(permission)) return true;
  const role = String(user?.role || "").toLowerCase();
  const permissions = ROLE_PERMISSIONS?.[role] || [];
  return permissions.includes(permission);
}

function matchesReferenceValue(row, rawValue) {
  const value = String(rawValue || "")
    .trim()
    .toLowerCase();
  if (!value) return false;
  return [row?.id, row?.name, row?.title, row?.display_name].some(
    (candidate) =>
      String(candidate || "")
        .trim()
        .toLowerCase() === value,
  );
}

/**
 * Registers admin user-management routes.
 *
 * System flow:
 * - Lists users and user details.
 * - Updates user role/status with audit-backed service methods.
 *
 * Dependencies:
 * - Route logic delegates domain rules to `users.service.js`.
 */
export function registerAdminUserRoutes(app, deps) {
  const {
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
    findUserById,
    assignUserToOrganizationEditor,
    assignUserToGroupEditor,
    createPasswordResetToken,
    sendEmail,
    config,
    listRoles,
    setUserRoles,
    logAuditEvent,
    userHasPermission,
  } = deps;

  const formatFullName = ({ first_name, middle_initial, last_name }) => {
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
  };

  /**
   * Middleware guard for `admin.users.manage` permission.
   */
  function requireAdminUsersManage(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (
      !hasPermission(
        req.user,
        "admin.users.manage",
        userHasPermission,
        ROLE_PERMISSIONS,
      )
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  }

  app.get(
    "/api/admin/users",
    authMiddleware,
    requireAdminUsersManage,
    async (req, res) => {
      try {
        // Returns flattened admin-facing user table rows.
        const rows = await listAdminUsers();
        return res.json({ data: rows });
      } catch (error) {
        return res
          .status(500)
          .json({ error: String(error?.message || "Failed to load users.") });
      }
    },
  );

  app.post(
    "/api/admin/users",
    authMiddleware,
    requireAdminUsersManage,
    async (req, res) => {
      try {
        const parsed = parseOrThrow(
          adminCreateProponentSchema,
          req.body || {},
          "Invalid user payload.",
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
          selectedOrg = (organizations || []).find((row) =>
            matchesReferenceValue(row, requestedOrgId),
          );
          if (!selectedOrg) {
            return res.status(400).json({
              error: "Selected research center was not found.",
            });
          }
        }

        if (requestedGroupId) {
          const groups = await listGroups();
          selectedGroup = (groups || []).find((row) =>
            matchesReferenceValue(row, requestedGroupId),
          );
          if (!selectedGroup) {
            return res.status(400).json({
              error: "Selected department was not found.",
            });
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
          email_verified: config.emailVerificationEnabled ? false : true,
          email_verified_at: config.emailVerificationEnabled
            ? null
            : new Date().toISOString(),
        });
        const inviteToken = await createPasswordResetToken(
          created.id,
          config.resetTokenTtlMinutes,
        );
        const inviteLink = buildResetLink(config.publicAppUrl, inviteToken);
        await sendEmail({
          to: created.email,
          subject: "Complete your ARMS account setup",
          html: buildInviteSetPasswordEmailHtml({
            fullName: created.full_name,
            link: inviteLink,
          }),
          text: buildInviteSetPasswordEmailText({
            fullName: created.full_name,
            link: inviteLink,
          }),
        });

        await logAuditEvent({
          actorUserId: req.user?.id || null,
          eventType: "admin.user.invite_sent",
          details: {
            target_user_id: created.id,
            target_email: created.email,
          },
        });

        return res.status(201).json({
          data: {
            id: created.id,
            full_name: created.full_name || null,
            email: created.email || null,
            role: created.role || null,
            department: created.department || null,
            ckan_org_id: created.ckan_org_id || null,
            ckan_group_id: created.ckan_group_id || null,
            ckan_username: created.ckan_username || null,
            ckan_user_id: created.ckan_user_id || null,
            is_active: created.is_active !== false,
            email_verified: created.email_verified === true,
            email_verified_at: created.email_verified_at || null,
            created_at: created.created_at || null,
            updated_at: created.updated_at || null,
            last_sign_in_at: null,
            email_confirmed_at: null,
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to create user."),
        });
      }
    },
  );

  app.post(
    "/api/admin/users/:userId/resend-invite",
    authMiddleware,
    requireAdminUsersManage,
    async (req, res) => {
      try {
        const targetUserId = String(req.params?.userId || "").trim();
        if (!targetUserId) {
          return res.status(400).json({ error: "User id is required." });
        }

        const user = await findUserById(targetUserId);
        if (!user) {
          return res.status(404).json({ error: "User not found." });
        }
        if (user.is_active === false) {
          return res.status(400).json({
            error: "Cannot send invite to a deactivated account.",
          });
        }
        if (user.email_verified === true) {
          return res.status(400).json({
            error: "User email is already verified.",
          });
        }

        const inviteToken = await createPasswordResetToken(
          user.id,
          config.resetTokenTtlMinutes,
        );
        const inviteLink = buildResetLink(config.publicAppUrl, inviteToken);
        await sendEmail({
          to: user.email,
          subject: "Complete your ARMS account setup",
          html: buildInviteSetPasswordEmailHtml({
            fullName: user.full_name,
            link: inviteLink,
          }),
          text: buildInviteSetPasswordEmailText({
            fullName: user.full_name,
            link: inviteLink,
          }),
        });

        await logAuditEvent({
          actorUserId: req.user?.id || null,
          eventType: "admin.user.invite_resent",
          details: {
            target_user_id: user.id,
            target_email: user.email,
          },
        });

        return res.json({ ok: true });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to resend invite."),
        });
      }
    },
  );

  app.get(
    "/api/admin/users/role-options",
    authMiddleware,
    requireAdminUsersManage,
    async (req, res) => {
      try {
        const roles = await listRoles({
          search: req.query?.search || "",
        });
        const assignable = (roles || []).filter(
          (role) =>
            String(role?.key || "")
              .trim()
              .toLowerCase() !== "center_chief",
        );
        return res.json({ data: assignable });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load role options."),
        });
      }
    },
  );

  app.get(
    "/api/admin/users/:userId/detail",
    authMiddleware,
    requireAdminUsersManage,
    async (req, res) => {
      try {
        // Includes project and role-audit summaries for selected user.
        const payload = await getAdminUserDetail(req.params.userId, {
          listDatasets,
        });
        if (!payload) {
          return res.status(404).json({ error: "User not found." });
        }
        return res.json(payload);
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load user detail."),
        });
      }
    },
  );

  app.patch(
    "/api/admin/users/:userId/role",
    authMiddleware,
    requireAdminUsersManage,
    async (req, res) => {
      try {
        const targetUserId = String(req.params?.userId || "").trim();
        if (!targetUserId)
          return res.status(400).json({ error: "User id is required." });
        const roleKey = String(req.body?.role || "")
          .trim()
          .toLowerCase();
        if (!roleKey)
          return res.status(400).json({ error: "Role is required." });
        if (roleKey === "center_chief") {
          return res.status(400).json({
            error:
              "Center Chief is assigned through Research Center management, not User Management.",
          });
        }

        const result = await setUserRoles({
          userId: targetUserId,
          roleKeys: [roleKey],
        });

        if (result?.error) {
          return res
            .status(Number(result.status) || 400)
            .json({ error: result.error });
        }

        await logAuditEvent({
          actorUserId: req.user?.id || null,
          eventType: "admin.user.role_updated",
          details: {
            target_user_id: targetUserId,
            new_role_key: roleKey,
            resolved_legacy_role:
              result?.data?.legacy_role || result?.data?.role || null,
          },
        });

        return res.json({
          data: {
            id: targetUserId,
            role: result?.data?.role || "student",
            roles: Array.isArray(result?.data?.roles) ? result.data.roles : [],
            permissions: Array.isArray(result?.data?.permissions)
              ? result.data.permissions
              : [],
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to update user role."),
        });
      }
    },
  );

  app.patch(
    "/api/admin/users/:userId/status",
    authMiddleware,
    requireAdminUsersManage,
    async (req, res) => {
      try {
        // Service enforces self-deactivation and last-admin safety rules.
        const result = await updateAdminUserStatus(
          {
            actorUserId: req.user?.id,
            targetUserId: req.params.userId,
            isActive: req.body?.isActive,
          },
          { updateUser, logAuditEvent },
        );

        if (result?.error) {
          return res
            .status(Number(result.status) || 400)
            .json({ error: result.error });
        }
        return res.json({ data: result.data || null });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to update user status."),
        });
      }
    },
  );
}
