import crypto from "node:crypto";

export function registerAwardsRoutes(app, deps) {
  const {
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
  } = deps;

  const PAGE_LIMIT = 100;
  const MAX_PAGES = 10;
  const MAX_MOV_UPLOAD_BYTES = 25 * 1024 * 1024;

  function toAwardSlug(value) {
    const base = asTrimmedString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return `${base || "award-record"}-${crypto.randomUUID().slice(0, 8)}`;
  }

  function getExtra(extras, key) {
    return asTrimmedString(getExtraByKey(extras, key));
  }

  function isAwardDataset(dataset) {
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    return getExtra(extras, "record_type").toLowerCase() === "award";
  }

  function isAwardOwnedByUser(dataset, user) {
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const submittedByUserId = getExtra(extras, "submitted_by_user_id");
    const submittedByEmail = getExtra(
      extras,
      "submitted_by_email",
    ).toLowerCase();
    const userId = asTrimmedString(user?.id);
    const userEmail = asTrimmedString(user?.email).toLowerCase();

    if (submittedByUserId && userId && submittedByUserId === userId)
      return true;
    if (submittedByEmail && userEmail && submittedByEmail === userEmail)
      return true;
    return false;
  }

  function isCenterChiefUser(user) {
    const role = asTrimmedString(user?.role).toLowerCase();
    return (
      role === "faculty" &&
      user?.is_center_chief === true &&
      Boolean(asTrimmedString(user?.managed_center_id))
    );
  }

  function isAwardInManagedCenter(dataset, user) {
    if (!isCenterChiefUser(user)) return false;
    const managedCenterId = asTrimmedString(user?.managed_center_id);
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const datasetOrgId =
      asTrimmedString(dataset?.organization?.name) ||
      asTrimmedString(dataset?.organization?.id) ||
      asTrimmedString(dataset?.owner_org) ||
      getExtra(extras, "research_center_id");
    if (!managedCenterId || !datasetOrgId) return false;
    return managedCenterId === datasetOrgId;
  }

  function upsertExtra(extras, key, value) {
    const normalizedKey = asTrimmedString(key).toLowerCase();
    const base = (Array.isArray(extras) ? extras : []).filter(
      (item) => asTrimmedString(item?.key).toLowerCase() !== normalizedKey,
    );
    if (value == null || value === "") return base;
    return [...base, { key, value }];
  }

  function normalizeRecipientUsers(value) {
    const list = Array.isArray(value) ? value : [];
    return list
      .map((item) => ({
        id: asTrimmedString(item?.id),
        name: asTrimmedString(item?.name),
        username: asTrimmedString(item?.username),
        email: asTrimmedString(item?.email),
      }))
      .filter((item) => item.id && item.name);
  }

  function parseRecipientUsers(extras) {
    const raw = getExtra(extras, "recipient_users");
    if (!raw) return [];
    try {
      return normalizeRecipientUsers(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  function parseSelectedUsers(rawValue) {
    const raw = asTrimmedString(rawValue);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      return rows
        .map((row) => ({
          id: asTrimmedString(row?.id),
          username: asTrimmedString(row?.username),
          email: asTrimmedString(row?.email).toLowerCase(),
        }))
        .filter((row) => row.id || row.username || row.email);
    } catch {
      return [];
    }
  }

  async function isUserLinkedToProject(projectId, user) {
    const cleanId = asTrimmedString(projectId);
    if (!cleanId || !user) return false;
    try {
      const dataset = await getDataset(cleanId);
      if (!dataset) return false;
      const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
      const leadUsers = parseSelectedUsers(
        getExtra(extras, "lead_researcher_user"),
      );
      const facultyUsers = parseSelectedUsers(
        getExtra(extras, "faculty_team_users"),
      );
      const selectedUsers = [...leadUsers, ...facultyUsers];
      if (!selectedUsers.length) return false;

      const candidateIds = new Set(
        [user?.ckan_user_id, user?.id]
          .map((value) => asTrimmedString(value))
          .filter(Boolean),
      );
      const candidateEmails = new Set(
        [user?.email]
          .map((value) => asTrimmedString(value).toLowerCase())
          .filter(Boolean),
      );
      const candidateUsername = asTrimmedString(
        user?.ckan_username,
      ).toLowerCase();

      return selectedUsers.some((row) => {
        const id = asTrimmedString(row?.id);
        const email = asTrimmedString(row?.email).toLowerCase();
        const username = asTrimmedString(row?.username).toLowerCase();
        if (id && candidateIds.has(id)) return true;
        if (email && candidateEmails.has(email)) return true;
        if (candidateUsername && username && username === candidateUsername)
          return true;
        return false;
      });
    } catch {
      return false;
    }
  }

  function buildAwardExtras(payload, user, existingExtras = []) {
    let extras = [];
    extras = upsertExtra(extras, "record_type", "award");
    extras = upsertExtra(
      extras,
      "submitted_by_user_id",
      getExtra(existingExtras, "submitted_by_user_id") ||
        asTrimmedString(user?.id),
    );
    extras = upsertExtra(
      extras,
      "submitted_by_email",
      getExtra(existingExtras, "submitted_by_email") ||
        asTrimmedString(user?.email),
    );
    extras = upsertExtra(
      extras,
      "submitted_by_name",
      getExtra(existingExtras, "submitted_by_name") ||
        asTrimmedString(user?.full_name) ||
        asTrimmedString(user?.email),
    );
    extras = upsertExtra(
      extras,
      "submitted_at",
      getExtra(existingExtras, "submitted_at") || new Date().toISOString(),
    );
    extras = upsertExtra(
      extras,
      "work_title",
      asTrimmedString(payload.work_title),
    );
    extras = upsertExtra(
      extras,
      "project_id",
      asTrimmedString(payload.project_id),
    );
    extras = upsertExtra(
      extras,
      "award_recognition",
      asTrimmedString(payload.award_recognition),
    );
    extras = upsertExtra(
      extras,
      "awarding_body",
      asTrimmedString(payload.awarding_body),
    );
    extras = upsertExtra(
      extras,
      "year_received",
      asTrimmedString(payload.year_received),
    );
    extras = upsertExtra(extras, "level", asTrimmedString(payload.level));
    extras = upsertExtra(
      extras,
      "recipients",
      asTrimmedString(payload.recipients),
    );
    extras = upsertExtra(
      extras,
      "recipient_users",
      JSON.stringify(normalizeRecipientUsers(payload.recipient_users)),
    );
    extras = upsertExtra(
      extras,
      "supporting_movs",
      asTrimmedString(payload.supporting_movs),
    );
    extras = upsertExtra(
      extras,
      "research_center_id",
      asTrimmedString(payload.research_center_id),
    );
    extras = upsertExtra(
      extras,
      "department_id",
      asTrimmedString(payload.department_id),
    );
    extras = upsertExtra(
      extras,
      "program_department",
      asTrimmedString(payload.program_department),
    );
    return extras;
  }

  function mapDatasetToAwardRecord(dataset) {
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const groups = Array.isArray(dataset?.groups) ? dataset.groups : [];
    const resources = Array.isArray(dataset?.resources)
      ? dataset.resources
      : [];
    const movResource = resources[0] || null;
    const recipientUsers = parseRecipientUsers(extras);
    const departmentTitle =
      groups[0]?.title ||
      groups[0]?.display_name ||
      getExtra(extras, "program_department");

    return {
      id: dataset?.id || dataset?.name || null,
      ckan_dataset_id: dataset?.id || dataset?.name || null,
      ckan_dataset_name: dataset?.name || null,
      title: dataset?.title || "",
      work_title: getExtra(extras, "work_title") || dataset?.title || "",
      award_recognition:
        getExtra(extras, "award_recognition") || dataset?.title || "",
      awarding_body: getExtra(extras, "awarding_body"),
      year_received: getExtra(extras, "year_received"),
      level: getExtra(extras, "level"),
      recipients: getExtra(extras, "recipients"),
      project_id: getExtra(extras, "project_id"),
      recipient_users: recipientUsers,
      supporting_movs: getExtra(extras, "supporting_movs"),
      notes: getExtra(extras, "notes") || dataset?.notes || "",
      research_center_id:
        getExtra(extras, "research_center_id") ||
        asTrimmedString(dataset?.owner_org),
      research_center_name:
        asTrimmedString(dataset?.organization?.title) ||
        asTrimmedString(dataset?.organization?.display_name) ||
        asTrimmedString(dataset?.organization?.name),
      department_id:
        getExtra(extras, "department_id") ||
        asTrimmedString(groups[0]?.id || groups[0]?.name),
      program_department: departmentTitle,
      supporting_mov_resource_id: movResource?.id || null,
      supporting_mov_file_name: movResource?.name || null,
      supporting_mov_file_path: movResource?.url || null,
      supporting_mov_file_mime_type:
        movResource?.mimetype || movResource?.format || null,
      supporting_mov_file_size: movResource?.size || null,
      submitted_by_user_id: getExtra(extras, "submitted_by_user_id"),
      submitted_by_email: getExtra(extras, "submitted_by_email"),
      submitted_by_name: getExtra(extras, "submitted_by_name"),
      created_at:
        getExtra(extras, "submitted_at") ||
        dataset?.metadata_created ||
        dataset?.metadata_modified ||
        null,
      updated_at:
        dataset?.metadata_modified || dataset?.metadata_created || null,
      private: Boolean(dataset?.private),
    };
  }

  function decodeBase64File(payload) {
    const raw = asTrimmedString(payload);
    if (!raw) return { buffer: null, mimeType: "" };

    const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/i);
    const mimeType = asTrimmedString(dataUrlMatch?.[1]);
    const base64Payload = asTrimmedString(dataUrlMatch?.[2] || raw).replace(
      /\s+/g,
      "",
    );
    if (!base64Payload) return { buffer: null, mimeType };

    return {
      buffer: Buffer.from(base64Payload, "base64"),
      mimeType,
    };
  }

  async function resolveDepartmentGroupName(departmentId) {
    const cleanDepartmentId = asTrimmedString(departmentId);
    if (!cleanDepartmentId) return "";
    const group = await getGroup(cleanDepartmentId);
    return asTrimmedString(group?.name) || asTrimmedString(group?.id);
  }

  async function resolveOwnerOrg(value, fallbackValue = "") {
    const candidate = asTrimmedString(value) || asTrimmedString(fallbackValue);
    if (!candidate) return "";
    const organizations = await listOrganizations();
    const selected = byAnyId(organizations || [], candidate);
    return asTrimmedString(selected?.name) || asTrimmedString(selected?.id);
  }

  async function isLinkedProjectPublic(projectId) {
    const cleanId = asTrimmedString(projectId);
    if (!cleanId) return false;
    try {
      const dataset = await getDataset(cleanId);
      if (!dataset) return false;
      return !Boolean(dataset?.private);
    } catch {
      return false;
    }
  }

  async function listAllAwardDatasets(user, query = "", projectId = "") {
    const isAdmin = asTrimmedString(user?.role).toLowerCase() === "admin";
    const orgId = isAdmin ? "" : asTrimmedString(user?.ckan_org_id);
    let page = 1;
    let allRows = [];
    let total = 0;

    while (page <= MAX_PAGES) {
      const result = await listDatasets({
        orgId,
        q: query,
        page,
        limit: PAGE_LIMIT,
      });
      const datasets = Array.isArray(result?.datasets) ? result.datasets : [];
      total = Number(result?.count || datasets.length || 0);
      allRows = allRows.concat(datasets);
      if (datasets.length < PAGE_LIMIT || allRows.length >= total) break;
      page += 1;
    }

    const targetProjectId = asTrimmedString(projectId);
    const linkedToProject = targetProjectId
      ? await isUserLinkedToProject(targetProjectId, user)
      : false;

    const filtered = allRows.filter((dataset) => {
      if (!isAwardDataset(dataset)) return false;
      if (isAdmin) return true;
      if (targetProjectId) {
        const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
        const matchesProject =
          getExtra(extras, "project_id") === targetProjectId;
        if (matchesProject && linkedToProject) return true;
      }
      return isAwardOwnedByUser(dataset, user);
    });

    if (!targetProjectId) return filtered;
    return filtered.filter((dataset) => {
      const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
      return getExtra(extras, "project_id") === targetProjectId;
    });
  }

  async function listCenterChiefAwardDatasets(user, query = "") {
    const managedCenterId = asTrimmedString(user?.managed_center_id);
    let page = 1;
    let allRows = [];
    let total = 0;

    while (page <= MAX_PAGES) {
      const result = await listDatasets({
        orgId: managedCenterId,
        q: query,
        page,
        limit: PAGE_LIMIT,
      });
      const datasets = Array.isArray(result?.datasets) ? result.datasets : [];
      total = Number(result?.count || datasets.length || 0);
      allRows = allRows.concat(datasets);
      if (datasets.length < PAGE_LIMIT || allRows.length >= total) break;
      page += 1;
    }

    return allRows.filter((dataset) => isAwardDataset(dataset));
  }

  async function listEligibleRecipientUsers(orgId = "") {
    const rows = orgId
      ? await listOrganizationMembers(orgId)
      : await listUsers();
    const users = Array.isArray(rows) ? rows : [];
    const resolved = await Promise.all(
      users.map(async (row) => {
        const email = asTrimmedString(row?.email).toLowerCase();
        if (!email) return null;
        const armsUser = await findUserByEmail(email);
        const role = asTrimmedString(armsUser?.role).toLowerCase();
        if (!["student", "faculty"].includes(role)) return null;
        return {
          id: row?.id || null,
          name:
            row?.fullname ||
            row?.display_name ||
            row?.name ||
            row?.email ||
            "CKAN User",
          username: row?.name || null,
          email: row?.email || null,
          role,
          state: row?.state || "active",
        };
      }),
    );

    return resolved
      .filter(
        (row) =>
          row && String(row?.state || "active").toLowerCase() !== "deleted",
      )
      .sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || "")),
      );
  }

  app.get("/api/awards", authMiddleware, async (req, res) => {
    try {
      const q = asTrimmedString(req.query?.q);
      const projectId = asTrimmedString(req.query?.project_id);
      const rows = await listAllAwardDatasets(req.user, q, projectId);
      return res.json({ data: rows.map(mapDatasetToAwardRecord) });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load award records."),
      });
    }
  });

  app.get("/api/awards/center-chief", authMiddleware, async (req, res) => {
    try {
      const role = asTrimmedString(req.user?.role).toLowerCase();
      const managedCenterId = asTrimmedString(req.user?.managed_center_id);
      const isCenterChief =
        role === "faculty" &&
        req.user?.is_center_chief === true &&
        Boolean(managedCenterId);

      if (!isCenterChief) {
        return res.status(403).json({
          error: "Center Chief access is required.",
        });
      }

      const q = asTrimmedString(req.query?.q);
      const rows = await listCenterChiefAwardDatasets(req.user, q);
      return res.json({ data: rows.map(mapDatasetToAwardRecord) });
    } catch (error) {
      return res.status(500).json({
        error: String(
          error?.message || "Failed to load center chief award records.",
        ),
      });
    }
  });

  app.get("/api/awards/recipient-options", authMiddleware, async (req, res) => {
    try {
      const rows = await listEligibleRecipientUsers("");
      return res.json({ data: rows });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load award recipients."),
      });
    }
  });

  app.get("/api/awards/:id", authMiddleware, async (req, res) => {
    try {
      const dataset = await getDataset(req.params.id);
      if (!dataset || !isAwardDataset(dataset)) {
        return res.status(404).json({ error: "Award record not found." });
      }

      const isAdmin = asTrimmedString(req.user?.role).toLowerCase() === "admin";
      if (!isAdmin) {
        const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
        const projectId = getExtra(extras, "project_id");
        const linkedToProject = projectId
          ? await isUserLinkedToProject(projectId, req.user)
          : false;
        if (
          !isAwardOwnedByUser(dataset, req.user) &&
          !linkedToProject &&
          !isAwardInManagedCenter(dataset, req.user)
        ) {
          return res
            .status(403)
            .json({ error: "You are not allowed to view this award record." });
        }
      }

      return res.json({ data: mapDatasetToAwardRecord(dataset) });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load award record."),
      });
    }
  });

  app.post("/api/awards", authMiddleware, async (req, res) => {
    try {
      const payload = parseOrThrow(
        awardRecognitionSchema,
        req.body || {},
        "Invalid award payload.",
      );

      const ownerOrg = await resolveOwnerOrg(
        payload.research_center_id,
        req.user?.ckan_org_id,
      );
      if (!ownerOrg) {
        return badRequest(
          res,
          "Research center (CKAN organization) is required.",
        );
      }

      const groupName = await resolveDepartmentGroupName(payload.department_id);
      const projectIsPublic = await isLinkedProjectPublic(payload.project_id);
      const dataset = await createDataset({
        name: toAwardSlug(payload.award_recognition || payload.work_title),
        title:
          asTrimmedString(payload.award_recognition) ||
          asTrimmedString(payload.work_title),
        notes:
          asTrimmedString(payload.notes) ||
          `Award received for ${asTrimmedString(payload.work_title) || "research work"}.`,
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
        private: projectIsPublic ? false : true,
        tags: [
          "award-record",
          asTrimmedString(payload.level).toLowerCase(),
          "award",
        ]
          .filter(Boolean)
          .map((value) => ({
            name: value.replace(/[^a-z0-9]+/g, "-"),
          })),
        groups: groupName ? [{ name: groupName }] : [],
        extras: buildAwardExtras(payload, req.user),
      });

      return res.status(201).json({ data: mapDatasetToAwardRecord(dataset) });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to create award record."),
      });
    }
  });

  app.patch("/api/awards/:id", authMiddleware, async (req, res) => {
    try {
      const existingDataset = await getDataset(req.params.id);
      if (!existingDataset || !isAwardDataset(existingDataset)) {
        return res.status(404).json({ error: "Award record not found." });
      }

      const isAdmin = asTrimmedString(req.user?.role).toLowerCase() === "admin";
      if (
        !isAdmin &&
        !isAwardOwnedByUser(existingDataset, req.user) &&
        !isAwardInManagedCenter(existingDataset, req.user)
      ) {
        return res
          .status(403)
          .json({ error: "You are not allowed to edit this award record." });
      }

      const payload = parseOrThrow(
        awardRecognitionSchema,
        req.body || {},
        "Invalid award payload.",
      );

      const ownerOrg = await resolveOwnerOrg(
        payload.research_center_id,
        existingDataset?.owner_org || req.user?.ckan_org_id,
      );
      if (!ownerOrg) {
        return badRequest(
          res,
          "Research center (CKAN organization) is required.",
        );
      }

      const groupName = await resolveDepartmentGroupName(payload.department_id);
      const projectIsPublic = await isLinkedProjectPublic(payload.project_id);
      const updated = await updateDataset({
        id: existingDataset.id || req.params.id,
        name:
          asTrimmedString(existingDataset?.name) ||
          toAwardSlug(payload.award_recognition || payload.work_title),
        title:
          asTrimmedString(payload.award_recognition) ||
          asTrimmedString(payload.work_title),
        notes:
          asTrimmedString(payload.notes) ||
          asTrimmedString(existingDataset?.notes) ||
          `Award received for ${asTrimmedString(payload.work_title) || "research work"}.`,
        owner_org: ownerOrg,
        author:
          asTrimmedString(existingDataset?.author) ||
          asTrimmedString(req.user?.full_name) ||
          asTrimmedString(req.user?.email) ||
          null,
        author_email:
          asTrimmedString(existingDataset?.author_email) ||
          asTrimmedString(req.user?.email) ||
          null,
        maintainer:
          asTrimmedString(existingDataset?.maintainer) ||
          asTrimmedString(req.user?.full_name) ||
          asTrimmedString(req.user?.email) ||
          null,
        maintainer_email:
          asTrimmedString(existingDataset?.maintainer_email) ||
          asTrimmedString(req.user?.email) ||
          null,
        private: projectIsPublic ? false : Boolean(existingDataset?.private),
        resources: Array.isArray(existingDataset?.resources)
          ? existingDataset.resources
          : [],
        tags: [
          "award-record",
          asTrimmedString(payload.level).toLowerCase(),
          "award",
        ]
          .filter(Boolean)
          .map((value) => ({
            name: value.replace(/[^a-z0-9]+/g, "-"),
          })),
        groups: groupName ? [{ name: groupName }] : [],
        extras: buildAwardExtras(
          payload,
          req.user,
          Array.isArray(existingDataset?.extras) ? existingDataset.extras : [],
        ),
      });

      return res.json({ data: mapDatasetToAwardRecord(updated) });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to update award record."),
      });
    }
  });

  app.delete("/api/awards/:id", authMiddleware, async (req, res) => {
    try {
      const dataset = await getDataset(req.params.id);
      if (!dataset || !isAwardDataset(dataset)) {
        return res.status(404).json({ error: "Award record not found." });
      }

      const isAdmin = asTrimmedString(req.user?.role).toLowerCase() === "admin";
      if (
        !isAdmin &&
        !isAwardOwnedByUser(dataset, req.user) &&
        !isAwardInManagedCenter(dataset, req.user)
      ) {
        return res
          .status(403)
          .json({ error: "You are not allowed to delete this award record." });
      }

      await deleteDataset(dataset.id || req.params.id);
      return res.json({
        data: {
          id: dataset.id || req.params.id,
          deleted: true,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to delete award record."),
      });
    }
  });

  app.post("/api/awards/:id/mov-upload", authMiddleware, async (req, res) => {
    try {
      const dataset = await getDataset(req.params.id);
      if (!dataset || !isAwardDataset(dataset)) {
        return res.status(404).json({ error: "Award record not found." });
      }

      const isAdmin = asTrimmedString(req.user?.role).toLowerCase() === "admin";
      if (
        !isAdmin &&
        !isAwardOwnedByUser(dataset, req.user) &&
        !isAwardInManagedCenter(dataset, req.user)
      ) {
        return res.status(403).json({
          error: "You are not allowed to upload MOVs for this award record.",
        });
      }

      const fileName =
        asTrimmedString(req.body?.file_name) || "award-supporting-mov.bin";
      const mimeTypeFromBody = asTrimmedString(req.body?.mime_type);
      const { buffer, mimeType: mimeTypeFromData } = decodeBase64File(
        req.body?.file_base64,
      );

      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return badRequest(res, "MOV file is required.");
      }
      if (buffer.length > MAX_MOV_UPLOAD_BYTES) {
        return badRequest(res, "MOV file must be 25MB or smaller.");
      }

      const existingResources = Array.isArray(dataset?.resources)
        ? dataset.resources
        : [];
      for (const resource of existingResources) {
        const resourceId = asTrimmedString(resource?.id);
        if (!resourceId) continue;
        await deleteDatasetResource(resourceId);
      }

      const mimeType =
        mimeTypeFromBody || mimeTypeFromData || "application/octet-stream";
      const resource = await createDatasetResourceUpload({
        fields: {
          package_id: dataset?.id || req.params.id,
          name: `Supporting MOV - ${fileName}`,
          description: "Supporting MOV attachment for award record",
          format: mimeType.split("/").pop()?.toUpperCase() || "FILE",
          mimetype: mimeType,
          size: String(buffer.length),
        },
        fileBuffer: buffer,
        fileName,
        mimeType,
      });

      return res.status(201).json({
        data: {
          resource_id: resource?.id || null,
          dataset_id: dataset?.id || req.params.id,
          file_name: resource?.name || fileName,
          file_path: resource?.url || null,
          mime_type: resource?.mimetype || resource?.format || mimeType,
          file_size: resource?.size || buffer.length,
          updated_at:
            resource?.last_modified ||
            dataset?.metadata_modified ||
            new Date().toISOString(),
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to upload award MOV."),
      });
    }
  });
}
