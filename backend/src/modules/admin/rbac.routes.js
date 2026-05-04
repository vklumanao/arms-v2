export function registerAdminRbacRoutes(app, deps) {
  const {
    authMiddleware,
    badRequest,
    logAuditEvent,
    listRoles,
    listPermissions,
    listRolePermissionMap,
    listRolePermissions,
    listUsersWithRoles,
    createRole,
    updateRole,
    deleteRole,
    setRolePermissions,
    userHasPermission,
  } = deps;

  function requireRbacManage(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (
      !userHasPermission(req.user, "admin.rbac.manage") &&
      !userHasPermission(req.user, "admin.controls.manage")
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  }

  function normalizeRolePermissionPayload(value) {
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value
          .map((entry) =>
            String(entry || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    ];
  }

  app.get(
    "/api/roles",
    authMiddleware,
    requireRbacManage,
    async (req, res) => {
      try {
        const roles = await listRoles({
          search: req.query?.search || "",
        });
        return res.json({ data: roles });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load roles."),
        });
      }
    },
  );

  app.get(
    "/api/permissions",
    authMiddleware,
    requireRbacManage,
    async (req, res) => {
      try {
        const permissions = await listPermissions({
          search: req.query?.search || "",
          module: req.query?.module || "",
          action: req.query?.action || "",
        });
        return res.json({ data: permissions });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load permissions."),
        });
      }
    },
  );

  app.get(
    "/api/roles/:roleId/permissions",
    authMiddleware,
    requireRbacManage,
    async (req, res) => {
      try {
        const roleId = String(req.params?.roleId || "").trim();
        if (!roleId) return badRequest(res, "Role id is required.");

        const result = await listRolePermissions(roleId);
        if (result?.error) {
          return res
            .status(Number(result.status) || 400)
            .json({ error: result.error });
        }
        return res.json({ data: result?.data || null });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to load role permission assignments.",
          ),
        });
      }
    },
  );

  app.post(
    "/api/roles/:roleId/permissions",
    authMiddleware,
    requireRbacManage,
    async (req, res) => {
      try {
        const roleId = String(req.params?.roleId || "").trim();
        if (!roleId) return badRequest(res, "Role id is required.");

        const permissionKeys = normalizeRolePermissionPayload(
          req.body?.permission_keys,
        );

        const result = await setRolePermissions(roleId, permissionKeys);
        if (result?.error) {
          return res
            .status(Number(result.status) || 400)
            .json({ error: result.error });
        }

        await logAuditEvent({
          actorUserId: req.user?.id || null,
          eventType: "rbac.role_permissions_updated",
          details: {
            role_id: roleId,
            permission_count: permissionKeys.length,
          },
        });

        return res.json({ data: result?.data || null });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to update role permission assignments.",
          ),
        });
      }
    },
  );

  app.get(
    "/api/admin/rbac/overview",
    authMiddleware,
    requireRbacManage,
    async (req, res) => {
      try {
        const [roles, permissions, rolePermissionMap, users] = await Promise.all([
          listRoles(),
          listPermissions(),
          listRolePermissionMap(),
          listUsersWithRoles({ limit: 500 }),
        ]);

        const groupedPermissions = permissions.reduce((acc, permission) => {
          const moduleName = String(permission?.module || "General").trim() || "General";
          if (!Array.isArray(acc[moduleName])) acc[moduleName] = [];
          acc[moduleName].push(permission);
          return acc;
        }, {});

        return res.json({
          data: {
            roles,
            permissions,
            groupedPermissions,
            rolePermissionMap,
            users,
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load RBAC overview."),
        });
      }
    },
  );

  app.post(
    "/api/admin/rbac/roles",
    authMiddleware,
    requireRbacManage,
    async (req, res) => {
      try {
        const payload = req.body || {};
        const name = String(payload.name || "").trim();
        if (!name) return badRequest(res, "Role name is required.");

        const result = await createRole({
          name,
          key: payload.key,
          description: payload.description,
          sort_order: payload.sort_order,
          parent_role_id: payload.parent_role_id,
        });

        if (result?.error) {
          return res
            .status(Number(result.status) || 400)
            .json({ error: result.error });
        }

        await logAuditEvent({
          actorUserId: req.user?.id || null,
          eventType: "rbac.role_created",
          details: {
            role_id: result?.data?.id || null,
            role_key: result?.data?.key || null,
          },
        });

        return res.status(201).json({ data: result?.data || null });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to create role."),
        });
      }
    },
  );

  app.patch(
    "/api/admin/rbac/roles/:roleId",
    authMiddleware,
    requireRbacManage,
    async (req, res) => {
      try {
        const roleId = String(req.params?.roleId || "").trim();
        if (!roleId) return badRequest(res, "Role id is required.");

        const result = await updateRole(roleId, req.body || {});
        if (result?.error) {
          return res
            .status(Number(result.status) || 400)
            .json({ error: result.error });
        }

        await logAuditEvent({
          actorUserId: req.user?.id || null,
          eventType: "rbac.role_updated",
          details: {
            role_id: result?.data?.id || roleId,
            role_key: result?.data?.key || null,
          },
        });

        return res.json({ data: result?.data || null });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to update role."),
        });
      }
    },
  );

  app.delete(
    "/api/admin/rbac/roles/:roleId",
    authMiddleware,
    requireRbacManage,
    async (req, res) => {
      try {
        const roleId = String(req.params?.roleId || "").trim();
        if (!roleId) return badRequest(res, "Role id is required.");

        const result = await deleteRole(roleId);
        if (result?.error) {
          return res
            .status(Number(result.status) || 400)
            .json({ error: result.error });
        }

        await logAuditEvent({
          actorUserId: req.user?.id || null,
          eventType: "rbac.role_deleted",
          details: {
            role_id: roleId,
            role_key: result?.data?.key || null,
          },
        });

        return res.json({ data: result?.data || null });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to delete role."),
        });
      }
    },
  );

  app.put(
    "/api/admin/rbac/roles/:roleId/permissions",
    authMiddleware,
    requireRbacManage,
    async (req, res) => {
      try {
        const roleId = String(req.params?.roleId || "").trim();
        if (!roleId) return badRequest(res, "Role id is required.");

        const permissionKeys = normalizeRolePermissionPayload(
          req.body?.permission_keys,
        );

        const result = await setRolePermissions(roleId, permissionKeys);
        if (result?.error) {
          return res
            .status(Number(result.status) || 400)
            .json({ error: result.error });
        }

        await logAuditEvent({
          actorUserId: req.user?.id || null,
          eventType: "rbac.role_permissions_updated",
          details: {
            role_id: roleId,
            permission_count: permissionKeys.length,
          },
        });

        return res.json({ data: result?.data || null });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to update role permission assignments.",
          ),
        });
      }
    },
  );

}
