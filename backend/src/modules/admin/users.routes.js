import {
  getAdminUserDetail,
  listAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "./users.service.js";

function hasPermission(user, permission, ROLE_PERMISSIONS) {
  const role = String(user?.role || "").toLowerCase();
  const permissions = ROLE_PERMISSIONS?.[role] || [];
  return permissions.includes(permission);
}

export function registerAdminUserRoutes(app, deps) {
  const {
    authMiddleware,
    ROLE_PERMISSIONS,
    listDatasets,
    updateUser,
    setOrganizationMemberRole,
    logAuditEvent,
  } = deps;

  function requireAdminUsersManage(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!hasPermission(req.user, "admin.users.manage", ROLE_PERMISSIONS)) {
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
        const rows = await listAdminUsers();
        return res.json({ data: rows });
      } catch (error) {
        return res
          .status(500)
          .json({ error: String(error?.message || "Failed to load users.") });
      }
    },
  );

  app.get(
    "/api/admin/users/:userId/detail",
    authMiddleware,
    requireAdminUsersManage,
    async (req, res) => {
      try {
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
        const result = await updateAdminUserRole(
          {
            actorUserId: req.user?.id,
            targetUserId: req.params.userId,
            role: req.body?.role,
          },
          { updateUser, setOrganizationMemberRole, logAuditEvent },
        );

        if (result?.error) {
          return res
            .status(Number(result.status) || 400)
            .json({ error: result.error });
        }
        return res.json({ data: result.data || null });
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
