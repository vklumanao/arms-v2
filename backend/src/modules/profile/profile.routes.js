export function registerProfileRoutes(app, deps) {
  const {
    authMiddleware,
    parseOrThrow,
    affiliateProfileUpdateSchema,
    updateUser,
    findUserById,
    computeAffiliateProfileMetrics,
  } = deps;

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

  app.patch("/api/affiliate-profile/me", authMiddleware, async (req, res) => {
    try {
      const parsed = parseOrThrow(
        affiliateProfileUpdateSchema,
        req.body || {},
        "Invalid affiliate profile payload.",
      );

      const patch = {};
      if ("full_name" in parsed) patch.full_name = parsed.full_name || null;
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
      const latest = updatedUser || (await findUserById(req.user.id));
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
      });
    } catch (error) {
      return res.status(400).json({
        error: String(error?.message || "Failed to update affiliate profile."),
      });
    }
  });
}
