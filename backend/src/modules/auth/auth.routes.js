/**
 * Registers auth- and permission-related API routes.
 *
 * System flow:
 * - Exposes health endpoint.
 * - Handles register/login/logout/session endpoints.
 * - Implements forgot/reset password flows.
 * - Exposes role-permission mapping for authorized clients.
 *
 * Dependency pattern:
 * - All collaborators are injected through `deps` to keep this module decoupled
 *   from direct imports and easier to test.
 */
export function registerAuthRoutes(app, deps) {
  const {
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
  } = deps;

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, service: "arms-backend" });
  });

  // Registration flow:
  // 1) Validate payload + role constraints.
  // 2) Verify organization/group existence in CKAN.
  // 3) Create/reuse CKAN user and memberships.
  // 4) Persist local user and audit outcome.
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
        // Admin accounts must be created through controlled admin channels.
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
      // Accept either CKAN id or name from client-provided selection.
      const selectedOrg = byAnyId(orgs, ckan_org_id);
      if (!selectedOrg) {
        return badRequest(res, "Selected CKAN organization was not found.");
      }

      let selectedGroup = null;
      if (ckan_group_id) {
        selectedGroup = byAnyId(groups, ckan_group_id);
        if (!selectedGroup) {
          return badRequest(
            res,
            "Selected CKAN group/department was not found.",
          );
        }
      }

      const ckanUser = await createOrGetUser({
        email,
        fullName: full_name,
        password,
      });

      // Assign baseline org role required for creating/editing datasets.
      await assignUserToOrganizationEditor({
        orgId: selectedOrg.name || selectedOrg.id,
        username: ckanUser.name,
      });

      if (selectedGroup) {
        // Department/group membership is optional depending on registration input.
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

  // Login flow:
  // 1) Validate credentials.
  // 2) Enforce account active status.
  // 3) Optionally refresh CKAN API token.
  // 4) Return signed JWT + sanitized user/profile payload.
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
          // Keep user CKAN token fresh for downstream integration requests.
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
      // Re-fetch user to include freshly persisted token/timestamps in response.
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

  // Stateless logout endpoint retained for audit trail symmetry.
  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    await logAuditEvent({
      actorUserId: req.user.id,
      eventType: "auth.logout",
      details: { email: req.user.email },
    });
    return res.json({ ok: true });
  });

  // Forgot-password flow intentionally returns generic success to avoid account enumeration.
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
      // Non-production convenience mode exposes token for local/test workflows.
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

  // Reset-password flow:
  // 1) Validate request.
  // 2) Consume token atomically (single-use).
  // 3) Update local password hash.
  // 4) Best-effort sync password to CKAN account.
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
          // CKAN password sync failure should not block successful local reset.
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

  // Permission map is protected to avoid exposing full authorization model publicly.
  app.get("/api/permissions/role-map", authMiddleware, (req, res) => {
    return res.json({ map: ROLE_PERMISSIONS });
  });
}
