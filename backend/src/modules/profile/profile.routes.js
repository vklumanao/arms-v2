/**
 * Registers affiliate profile API routes.
 *
 * System flow:
 * - `GET /api/affiliate-profile/me` returns authenticated user profile + computed metrics.
 * - `PATCH /api/affiliate-profile/me` validates patchable fields, persists updates,
 *   then returns latest profile + refreshed metrics.
 *
 * Dependencies:
 * - Uses injected auth, validation, store, and metrics functions from server composition.
 */
export function registerProfileRoutes(app, deps) {
  const {
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
    removeUserFromOrganization,
    removeUserFromGroup,
    logAuditEvent,
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

  // Returns current user's profile view model with live research metrics.
  app.get("/api/affiliate-profile/me", authMiddleware, async (req, res) => {
    try {
      const metrics = await computeAffiliateProfileMetrics(req.user);
      return res.json({
        data: {
          id: req.user.id,
          full_name: req.user.full_name || "",
          email: req.user.email || "",
          role: req.user.role || "faculty",
          department: req.user.department || "",
          ckan_org_id: req.user.ckan_org_id || "",
          ckan_group_id: req.user.ckan_group_id || "",
          ckan_username: req.user.ckan_username || "",
          ckan_user_id: req.user.ckan_user_id || "",
          google_scholar_link: req.user.google_scholar_link || "",
          employment_status: req.user.employment_status || "",
          designation: req.user.designation || "",
          is_gs_faculty: Boolean(req.user.is_gs_faculty),
          ...metrics,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load affiliate profile."),
      });
    }
  });

  // Updates editable affiliate profile fields only; immutable auth fields stay untouched.
  app.patch("/api/affiliate-profile/me", authMiddleware, async (req, res) => {
    try {
      const parsed = parseOrThrow(
        affiliateProfileUpdateSchema,
        req.body || {},
        "Invalid affiliate profile payload.",
      );

      const previousOrgId = String(req.user?.ckan_org_id || "").trim();
      const requestedOrgId = String(parsed?.ckan_org_id || "").trim();
      if (previousOrgId && "ckan_org_id" in parsed && !requestedOrgId) {
        return badRequest(
          res,
          "Research Center cannot be cleared once it has been set.",
        );
      }

      let selectedOrg = null;
      let selectedGroup = null;
      if (requestedOrgId || String(parsed?.ckan_group_id || "").trim()) {
        const [orgs, groups] = await Promise.all([
          listOrganizations(),
          listGroups(),
        ]);

        if (requestedOrgId) {
          selectedOrg = byAnyId(orgs, requestedOrgId);
          if (!selectedOrg) {
            return badRequest(res, "Selected Research Center was not found.");
          }
        }

        const requestedGroupId = String(parsed?.ckan_group_id || "").trim();
        if (requestedGroupId) {
          selectedGroup = byAnyId(groups, requestedGroupId);
          if (!selectedGroup) {
            return badRequest(res, "Selected department was not found.");
          }
        }
      }

      const patch = {};
      // Build sparse patch so omitted fields are not overwritten.
      const hasNameParts =
        "first_name" in parsed ||
        "middle_initial" in parsed ||
        "last_name" in parsed;
      if (hasNameParts) {
        patch.full_name = formatFullName(parsed) || null;
      } else if ("full_name" in parsed) {
        patch.full_name = parsed.full_name || null;
      }
      if ("department" in parsed) patch.department = parsed.department || null;
      if ("ckan_org_id" in parsed) {
        patch.ckan_org_id =
          selectedOrg?.name ||
          selectedOrg?.id ||
          parsed.ckan_org_id ||
          null;
      }
      if ("ckan_group_id" in parsed) {
        patch.ckan_group_id =
          selectedGroup?.name ||
          selectedGroup?.id ||
          parsed.ckan_group_id ||
          null;
      }
      if ("ckan_group_id" in parsed && !("department" in parsed)) {
        patch.department =
          selectedGroup?.title ||
          selectedGroup?.display_name ||
          selectedGroup?.name ||
          null;
      }
      if ("google_scholar_link" in parsed) {
        patch.google_scholar_link = parsed.google_scholar_link || null;
      }
      if ("employment_status" in parsed) {
        patch.employment_status = parsed.employment_status || null;
      }
      if ("designation" in parsed)
        patch.designation = parsed.designation || null;
      if ("is_gs_faculty" in parsed) {
        patch.is_gs_faculty = Boolean(parsed.is_gs_faculty);
      }

      const updatedUser = await updateUser(req.user.id, patch);
      // Re-read latest state when store returns null to keep response deterministic.
      const latest = updatedUser || (await findUserById(req.user.id));
      const latestOrgId = String(latest?.ckan_org_id || "").trim();
      const latestGroupId = String(latest?.ckan_group_id || "").trim();
      const latestUsername = String(latest?.ckan_username || "").trim();
      const previousGroupId = String(req.user?.ckan_group_id || "").trim();
      const warnings = [];

      if (latestUsername && latestOrgId && latestOrgId !== previousOrgId) {
        try {
          if (previousOrgId) {
            await removeUserFromOrganization({
              orgId: previousOrgId,
              username: latestUsername,
            });
          }
          await assignUserToOrganizationEditor({
            orgId: latestOrgId,
            username: latestUsername,
          });
          await logAuditEvent({
            actorUserId: latest?.id || req.user.id,
            eventType: "ckan.organization_membership_move_success",
            details: {
              previous_ckan_org_id: previousOrgId || null,
              ckan_org_id: latestOrgId,
              ckan_username: latestUsername,
            },
          });
        } catch (error) {
          warnings.push(
            "Profile was updated, but moving organization membership in CKAN failed.",
          );
          await logAuditEvent({
            actorUserId: latest?.id || req.user.id,
            eventType: "ckan.organization_membership_move_failed",
            details: {
              previous_ckan_org_id: previousOrgId || null,
              ckan_org_id: latestOrgId,
              ckan_username: latestUsername,
              message: String(error?.message || "Unknown error"),
            },
          });
        }
      }

      if (latestUsername && latestGroupId && latestGroupId !== previousGroupId) {
        try {
          if (previousGroupId) {
            await removeUserFromGroup({
              groupId: previousGroupId,
              username: latestUsername,
            });
          }
          await assignUserToGroupEditor({
            groupId: latestGroupId,
            username: latestUsername,
          });
          await logAuditEvent({
            actorUserId: latest?.id || req.user.id,
            eventType: "ckan.group_membership_move_success",
            details: {
              previous_ckan_group_id: previousGroupId || null,
              ckan_group_id: latestGroupId,
              ckan_username: latestUsername,
            },
          });
        } catch (error) {
          warnings.push(
            "Profile was updated, but moving department membership in CKAN failed.",
          );
          await logAuditEvent({
            actorUserId: latest?.id || req.user.id,
            eventType: "ckan.group_membership_move_failed",
            details: {
              previous_ckan_group_id: previousGroupId || null,
              ckan_group_id: latestGroupId,
              ckan_username: latestUsername,
              message: String(error?.message || "Unknown error"),
            },
          });
        }
      }

      const metrics = await computeAffiliateProfileMetrics(latest || req.user);

      return res.json({
        data: {
          id: latest?.id || req.user.id,
          full_name: latest?.full_name || "",
          email: latest?.email || "",
          role: latest?.role || req.user.role || "faculty",
          department: latest?.department || "",
          ckan_org_id: latest?.ckan_org_id || "",
          ckan_group_id: latest?.ckan_group_id || "",
          ckan_username: latest?.ckan_username || "",
          ckan_user_id: latest?.ckan_user_id || "",
          google_scholar_link: latest?.google_scholar_link || "",
          employment_status: latest?.employment_status || "",
          designation: latest?.designation || "",
          is_gs_faculty: Boolean(latest?.is_gs_faculty),
          ...metrics,
        },
        warnings,
      });
    } catch (error) {
      return res.status(400).json({
        error: String(error?.message || "Failed to update affiliate profile."),
      });
    }
  });
}
