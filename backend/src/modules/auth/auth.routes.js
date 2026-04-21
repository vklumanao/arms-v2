import {
  buildResetLink,
  buildResetPasswordEmailHtml,
  buildResetPasswordEmailText,
  buildVerificationEmailHtml,
  buildVerificationLink,
} from "./auth.email.js";

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
    changePasswordRateLimit,
    authMiddleware,
    parseOrThrow,
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    resendVerificationSchema,
    changePasswordSchema,
    config,
    DEFAULT_ROLE_PERMISSIONS,
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
    createEmailVerificationToken,
    consumeEmailVerificationToken,
    sendEmail,
    logAuditEvent,
    listRolePermissionMap,
    saveRolePermissionMap,
    resetRolePermissionMapToDefaults,
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

  const resetEmailCooldowns = new Map();

  const getResetCooldownSeconds = (email) => {
    const until = resetEmailCooldowns.get(email);
    if (!until) return 0;
    const remainingMs = Math.max(until - Date.now(), 0);
    if (remainingMs === 0) {
      resetEmailCooldowns.delete(email);
      return 0;
    }
    return Math.ceil(remainingMs / 1000);
  };

  const setResetCooldown = (email) => {
    const cooldownSeconds = Number(config.resetEmailCooldownSeconds || 0);
    if (!Number.isFinite(cooldownSeconds) || cooldownSeconds <= 0) return;
    resetEmailCooldowns.set(
      email,
      Date.now() + Math.round(cooldownSeconds * 1000),
    );
  };

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

      const full_name = formatFullName(parsed);
      const email = parsed.email.trim().toLowerCase();
      const password = parsed.password;
      const role = normalizeRole(parsed.role);
      const department = String(parsed.department || "").trim();
      const ckan_org_id = String(parsed.ckan_org_id || "").trim();
      const ckan_group_id = String(parsed.ckan_group_id || "").trim();

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

      let selectedOrg = null;
      let selectedGroup = null;
      if (ckan_org_id || ckan_group_id) {
        const [orgs, groups] = await Promise.all([
          ckan_org_id ? listOrganizations() : Promise.resolve([]),
          ckan_group_id ? listGroups() : Promise.resolve([]),
        ]);

        // Organization is optional during registration.
        selectedOrg = ckan_org_id ? byAnyId(orgs, ckan_org_id) : null;
        if (ckan_org_id && !selectedOrg) {
          return badRequest(res, "Selected CKAN organization was not found.");
        }

        if (ckan_group_id) {
          selectedGroup = byAnyId(groups, ckan_group_id);
          if (!selectedGroup) {
            return badRequest(
              res,
              "Selected CKAN group/department was not found.",
            );
          }
        }
      }

      const ckanUser = await createOrGetUser({
        email,
        fullName: full_name,
        password,
      });

      if (selectedOrg) {
        // Assign baseline org role only when user selected an organization.
        await assignUserToOrganizationEditor({
          orgId: selectedOrg.name || selectedOrg.id,
          username: ckanUser.name,
        });
      }

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
        ckan_org_id: selectedOrg?.name || selectedOrg?.id || null,
        ckan_group_id: selectedGroup?.name || selectedGroup?.id || null,
        ckan_username: ckanUser.name,
        ckan_user_id: ckanUser.id || null,
        email_verified: config.emailVerificationEnabled ? false : true,
        email_verified_at: config.emailVerificationEnabled
          ? null
          : new Date().toISOString(),
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

      if (config.emailVerificationEnabled) {
        const token = await createEmailVerificationToken(
          created.id,
          config.emailVerifyTokenTtlMinutes,
        );
        const link = buildVerificationLink(config.publicAppUrl, token);
        await sendEmail({
          to: created.email,
          subject: "Verify your ARMS account",
          html: buildVerificationEmailHtml({
            fullName: created.full_name,
            link,
          }),
        });

        await logAuditEvent({
          actorUserId: created.id,
          eventType: "auth.verify_email_sent",
          details: { email: created.email },
        });

        return res.status(201).json({
          ok: true,
          requires_verification: true,
          email: created.email,
        });
      }

      const authUser = await resolveCenterChiefContext(created);
      const token = signSession(authUser);
      setSessionCookie(res, token);
      return res.status(201).json(toAuthPayload(authUser, null));
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

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      if (!config.emailVerificationEnabled) {
        return badRequest(res, "Email verification is disabled.");
      }
      const parsed = parseOrThrow(
        verifyEmailSchema,
        req.body,
        "Invalid verification payload.",
      );
      const consumed = await consumeEmailVerificationToken(parsed.token);
      if (!consumed) {
        return res
          .status(400)
          .json({ error: "Invalid or expired verification token." });
      }

      const user = await findUserById(consumed.user_id);
      if (!user) {
        return res
          .status(400)
          .json({ error: "User not found for verification token." });
      }

      if (user.email_verified === true) {
        return res.json({ ok: true, already_verified: true });
      }

      await updateUser(user.id, {
        email_verified: true,
        email_verified_at: new Date().toISOString(),
      });

      await logAuditEvent({
        actorUserId: user.id,
        eventType: "auth.email_verified",
        details: { email: user.email },
      });

      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Email verification failed."),
      });
    }
  });

  app.post(
    "/api/auth/resend-verification",
    forgotRateLimit,
    async (req, res) => {
      try {
        if (!config.emailVerificationEnabled) {
          return badRequest(res, "Email verification is disabled.");
        }
        const parsed = parseOrThrow(
          resendVerificationSchema,
          req.body,
          "Invalid resend payload.",
        );

        const email = parsed.email.trim().toLowerCase();
        const user = await findUserByEmail(email);
        if (!user || user.email_verified === true) {
          return res.json({ ok: true });
        }

        const token = await createEmailVerificationToken(
          user.id,
          config.emailVerifyTokenTtlMinutes,
        );
        const link = buildVerificationLink(config.publicAppUrl, token);
        await sendEmail({
          to: user.email,
          subject: "Verify your ARMS account",
          html: buildVerificationEmailHtml({
            fullName: user.full_name,
            link,
          }),
        });

        await logAuditEvent({
          actorUserId: user.id,
          eventType: "auth.verify_email_resent",
          details: { email: user.email },
        });

        return res.json({ ok: true });
      } catch (error) {
        return res
          .status(500)
          .json({ error: String(error?.message || "Resend failed.") });
      }
    },
  );

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
      if (config.emailVerificationEnabled && user.email_verified !== true) {
        await logAuditEvent({
          actorUserId: user.id,
          eventType: "auth.login_blocked",
          details: { reason: "email_unverified" },
        });
        return res.status(403).json({
          error: "Email is not verified. Please check your inbox.",
          code: "EMAIL_NOT_VERIFIED",
        });
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

      setSessionCookie(res, token);
      const authUser = await resolveCenterChiefContext(latest);
      return res.json(toAuthPayload(authUser, null));
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
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  // Authenticated change-password flow:
  // 1) Validate payload and current password.
  // 2) Update local password hash.
  // 3) Best-effort sync to CKAN account.
  app.post(
    "/api/auth/change-password",
    authMiddleware,
    changePasswordRateLimit,
    async (req, res) => {
      try {
        const parsed = parseOrThrow(
          changePasswordSchema,
          req.body,
          "Invalid change-password payload.",
        );

        if (parsed.new_password !== parsed.confirm_password) {
          return badRequest(res, "New password and confirmation do not match.");
        }
        if (parsed.current_password === parsed.new_password) {
          return badRequest(
            res,
            "New password must be different from current password.",
          );
        }

        const user = await findUserById(req.user.id);
        if (!user || user.is_active === false) return unauthorized(res);

        const ok = await verifyPassword(user, parsed.current_password);
        if (!ok) {
          await logAuditEvent({
            actorUserId: user.id,
            eventType: "auth.change_password_failed",
            details: { reason: "bad_current_password" },
          });
          return unauthorized(res, "Current password is incorrect.");
        }

        const password_hash = await hashPassword(parsed.new_password);
        await updateUser(user.id, { password_hash });

        let warning = "";
        if (user.ckan_username) {
          try {
            await updateCkanUserPassword(
              user.ckan_username,
              parsed.new_password,
            );
            await logAuditEvent({
              actorUserId: user.id,
              eventType: "ckan.password_sync_success",
              details: { ckan_username: user.ckan_username },
            });
          } catch (error) {
            warning =
              "Password changed locally, but CKAN password sync failed. Please contact support if CKAN login is affected.";
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
          eventType: "auth.password_changed",
          details: { email: user.email },
        });

        return res.json({ ok: true, warning: warning || null });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Change password failed."),
        });
      }
    },
  );

  // Forgot-password flow intentionally returns generic success to avoid account enumeration.
  app.post("/api/auth/forgot-password", forgotRateLimit, async (req, res) => {
    try {
      const parsed = parseOrThrow(
        forgotPasswordSchema,
        req.body,
        "Invalid forgot-password payload.",
      );
      const email = parsed.email.trim().toLowerCase();
      const cooldownSeconds = getResetCooldownSeconds(email);
      if (cooldownSeconds > 0) {
        res.setHeader("Retry-After", String(cooldownSeconds));
        return res.status(429).json({
          error: `Please wait ${cooldownSeconds} seconds before requesting another reset email.`,
          code: "RESET_EMAIL_COOLDOWN",
          retry_after_seconds: cooldownSeconds,
        });
      }

      const user = await findUserByEmail(email);

      if (!user || user.is_active === false) {
        await logAuditEvent({
          eventType: "auth.forgot_password_ignored",
          details: { email },
        });
        setResetCooldown(email);
        return res.json({ ok: true });
      }

      const token = await createPasswordResetToken(
        user.id,
        config.resetTokenTtlMinutes,
      );

      const link = buildResetLink(config.publicAppUrl, token);
      if (String(config.nodeEnv || "").toLowerCase() === "development") {
        console.log(
          `[AUTH] Password reset link for ${user.email}: ${link}`,
        );
      }
      await sendEmail({
        to: user.email,
        subject: "Reset your ARMS password",
        html: buildResetPasswordEmailHtml({
          fullName: user.full_name,
          link,
        }),
        text: buildResetPasswordEmailText({
          fullName: user.full_name,
          link,
        }),
      });
      setResetCooldown(email);

      await logAuditEvent({
        actorUserId: user.id,
        eventType: "auth.forgot_password_requested",
        details: { email: user.email },
      });

      const payload = { ok: true };
      // Only expose reset tokens in explicit local development debug mode.
      if (
        config.nodeEnv === "development" &&
        config.exposeResetTokenInResponse
      ) {
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
        return res
          .status(400)
          .json({ error: "Invalid or expired reset token." });
      }

      const user = await findUserById(consumed.user_id);
      if (!user || user.is_active === false) {
        return res
          .status(400)
          .json({ error: "Account is not eligible for reset." });
      }

      const password_hash = await hashPassword(parsed.password);
      const patch = { password_hash };
      if (config.emailVerificationEnabled && user.email_verified !== true) {
        patch.email_verified = true;
        patch.email_verified_at = new Date().toISOString();
      }
      await updateUser(user.id, patch);

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
      if (config.emailVerificationEnabled && user.email_verified !== true) {
        await logAuditEvent({
          actorUserId: user.id,
          eventType: "auth.email_verified_via_password_setup",
          details: { email: user.email },
        });
      }

      return res.json({ ok: true });
    } catch (error) {
      return res
        .status(500)
        .json({ error: String(error?.message || "Reset password failed.") });
    }
  });

  // Permission map is protected to avoid exposing full authorization model publicly.
  app.get("/api/permissions/role-map", authMiddleware, async (req, res) => {
    const map = await listRolePermissionMap();
    return res.json({ map });
  });

  function normalizePermissionList(rawList) {
    const next = [];
    const seen = new Set();
    for (const item of rawList || []) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      next.push(trimmed);
    }
    return next;
  }

  function normalizeRolePermissionMap(rawMap) {
    const roles = Object.keys(
      DEFAULT_ROLE_PERMISSIONS || ROLE_PERMISSIONS || {},
    );
    const next = {};
    for (const role of roles) {
      next[role] = normalizePermissionList(rawMap?.[role] || []);
    }

    // Prevent locking the system by ensuring admin can still access controls.
    if (Array.isArray(next.admin)) {
      if (!next.admin.includes("admin.controls.manage")) {
        next.admin.push("admin.controls.manage");
      }
    }

    return next;
  }

  // Updates the persistent role-to-permission map.
  app.put("/api/permissions/role-map", authMiddleware, async (req, res) => {
    if (!userHasPermission(req.user, "admin.controls.manage")) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const rawMap = req.body?.map;
    if (!rawMap || typeof rawMap !== "object") {
      return badRequest(res, "Invalid payload: expected { map: { ... } }");
    }

    const nextMap = normalizeRolePermissionMap(rawMap);
    const savedMap = await saveRolePermissionMap(nextMap);

    await logAuditEvent({
      actorUserId: req.user?.id || null,
      eventType: "permissions.role_map_updated",
      details: { roles: Object.keys(nextMap) },
    });

    return res.json({ ok: true, map: savedMap });
  });

  app.post(
    "/api/permissions/role-map/reset",
    authMiddleware,
    async (req, res) => {
      if (!userHasPermission(req.user, "admin.controls.manage")) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const map = await resetRolePermissionMapToDefaults();

      await logAuditEvent({
        actorUserId: req.user?.id || null,
        eventType: "permissions.role_map_reset",
        details: {},
      });

      return res.json({ ok: true, map });
    },
  );
}
