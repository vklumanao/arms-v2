import crypto from "node:crypto";

/**
 * Registers submission routes for research outputs and CKAN publishing.
 *
 * System flow:
 * - Lists current user's submitted research-output resources.
 * - Creates/updates CKAN dataset plus resources for project submissions.
 *
 * Dependency pattern:
 * - Route logic is composed with injected helpers and CKAN client calls.
 */
export function registerSubmissionsRoutes(app, deps) {
  const {
    authMiddleware,
    badRequest,
    config,
    asTrimmedString,
    asNumber,
    listDatasets,
    getDataset,
    createDataset,
    updateDataset,
    setDatasetVisibility,
    deleteDataset,
    createDatasetResource,
    updateDatasetResource,
    deleteDatasetResource,
    getExtraByKey,
  } = deps;

  /**
   * Converts free-text title into CKAN-compatible dataset name slug.
   *
   * Edge case:
   * - Generates timestamp-based fallback when slug would be empty.
   */
  function toCkanName(value) {
    const base = asTrimmedString(value)
      .toLowerCase()
      .replace(/[^a-z0-9_\-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    if (base) return base;
    return `dataset-${Date.now()}`;
  }

  /**
   * Builds a display name for each expected output resource.
   *
   * Data transformation:
   * - Prefers explicit output type + target count when available.
   * - Falls back to indexed generic label.
   */
  function formatOutputResourceName(row, index) {
    const outputType = asTrimmedString(row?.output_type || row?.outputType);
    const targetCount = Math.max(
      1,
      Number(row?.target_count || row?.targetCount || 1) || 1,
    );
    if (outputType) return `${outputType} (Target: ${targetCount})`;
    return `Expected Output ${index + 1}`;
  }

  /**
   * Converts submission form fields into CKAN dataset extras metadata.
   *
   * Important logic:
   * - Captures submitter identity metadata for ownership and audit correlation.
   * - Filters empty values so CKAN extras remain compact.
   */
  function toDatasetExtras(form = {}, user = null) {
    const submittedAt = new Date().toISOString();
    // Trace id helps correlate CKAN datasets/resources with audit logs.
    const traceId = crypto.randomUUID();
    return [
      { key: "submitted_by_user_id", value: asTrimmedString(user?.id) || null },
      {
        key: "submitted_by_email",
        value: asTrimmedString(user?.email) || null,
      },
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
      {
        key: "faculty_team",
        value: asTrimmedString(form.faculty_team) || null,
      },
      {
        key: "student_team",
        value: asTrimmedString(form.student_team) || null,
      },
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
      {
        key: "funding_type",
        value: asTrimmedString(form.funding_type) || null,
      },
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

  /**
   * Checks dataset ownership against submission metadata fields.
   *
   * Used to ensure non-admin users can only mutate visibility of their own datasets.
   */
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

    if (submittedByUserId && userId && submittedByUserId === userId)
      return true;
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

  /**
   * Adds or replaces a dataset extra value (case-insensitive key match).
   */
  function upsertExtra(extras, key, value) {
    const rows = Array.isArray(extras) ? extras : [];
    const normalizedKey = asTrimmedString(key).toLowerCase();
    const filtered = rows.filter(
      (item) => asTrimmedString(item?.key).toLowerCase() !== normalizedKey,
    );
    if (value == null || value === "") return filtered;
    return [...filtered, { key, value }];
  }

  /**
   * Builds editable submission form payload from a CKAN dataset.
   */
  function mapDatasetToEditableForm(dataset) {
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const yearFromExtra = asTrimmedString(
      getExtraByKey(extras, "project_year") || getExtraByKey(extras, "year"),
    );
    const createdYear = new Date(
      dataset?.metadata_created || dataset?.metadata_modified || 0,
    ).getFullYear();

    return {
      id: dataset?.id || dataset?.name || null,
      title: asTrimmedString(dataset?.title || dataset?.name),
      lead_researcher: asTrimmedString(
        getExtraByKey(extras, "lead_researcher"),
      ),
      faculty_team: asTrimmedString(getExtraByKey(extras, "faculty_team")),
      student_team: asTrimmedString(getExtraByKey(extras, "student_team")),
      abstract: asTrimmedString(dataset?.notes),
      year:
        yearFromExtra ||
        (Number.isFinite(createdYear) && createdYear > 0
          ? String(createdYear)
          : String(new Date().getFullYear())),
      research_center_id: asTrimmedString(
        dataset?.organization?.name || dataset?.owner_org,
      ),
      research_agenda_id: asTrimmedString(
        getExtraByKey(extras, "research_agenda_id"),
      ),
      department_id: asTrimmedString(getExtraByKey(extras, "department_id")),
      scholarly_type: asTrimmedString(getExtraByKey(extras, "scholarly_type")),
      funding_type:
        asTrimmedString(getExtraByKey(extras, "funding_type")) || "none",
      funding_category: asTrimmedString(
        getExtraByKey(extras, "funding_category"),
      ),
      industry_partner: asTrimmedString(
        getExtraByKey(extras, "industry_partner"),
      ),
      funding_source: asTrimmedString(getExtraByKey(extras, "funding_source")),
      funding_amount:
        asTrimmedString(getExtraByKey(extras, "funding_amount")) || "0",
      classification:
        asTrimmedString(getExtraByKey(extras, "classification")) || "academic",
      status:
        asTrimmedString(
          getExtraByKey(extras, "project_status") ||
            getExtraByKey(extras, "status"),
        ) || "ongoing",
      expected_outputs: asTrimmedString(
        getExtraByKey(extras, "expected_outputs_summary"),
      ),
      supporting_mov_link: asTrimmedString(
        getExtraByKey(extras, "supporting_mov_link"),
      ),
      signed_moa_reference: asTrimmedString(
        getExtraByKey(extras, "signed_moa_reference"),
      ),
      start_date: asTrimmedString(getExtraByKey(extras, "start_date")),
      end_date: asTrimmedString(getExtraByKey(extras, "end_date")),
      public_visible: !Boolean(dataset?.private),
    };
  }

  /**
   * Maps CKAN dataset resources into expected-output rows used by submit edit mode.
   */
  function mapResourcesToExpectedOutputs(dataset) {
    const allowedOutputTypes = new Set([
      "publication",
      "patent_ip",
      "people_services",
      "places_partnerships",
      "policies",
      "product_software",
    ]);
    const resources = Array.isArray(dataset?.resources)
      ? dataset.resources
      : [];
    return resources.map((resource, index) => {
      const name = asTrimmedString(resource?.name);
      const targetMatch = name.match(/\(target:\s*(\d+)\)/i);
      const targetCount = Math.max(1, Number(targetMatch?.[1] || 1) || 1);
      const rawType = name
        .replace(/\s*\(target:[^)]+\)\s*$/i, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const normalizedType =
        rawType === "patent" || rawType === "ip"
          ? "patent_ip"
          : rawType === "people_service"
            ? "people_services"
            : rawType === "place_partnerships" ||
                rawType === "places_and_partnerships"
              ? "places_partnerships"
              : rawType === "products_software_application" ||
                  rawType === "product_software_application"
                ? "product_software"
                : rawType;

      return {
        id: resource?.id || `resource-${index + 1}`,
        output_type: allowedOutputTypes.has(normalizedType)
          ? normalizedType
          : "publication",
        target_count: targetCount,
        notes: asTrimmedString(resource?.description),
        file_path: asTrimmedString(resource?.url),
        file_name: asTrimmedString(resource?.name),
        mime_type: asTrimmedString(resource?.mimetype || resource?.format),
        file_size: Number(resource?.size || 0) || null,
      };
    });
  }

  /**
   * Locates a resource together with its parent dataset.
   *
   * System flow:
   * - Non-admins are scoped to their CKAN organization.
   * - Admins search across organizations.
   * - Iterates CKAN dataset pages until the resource id is found.
   */
  async function findDatasetByResourceId(resourceId, user) {
    const id = asTrimmedString(resourceId);
    if (!id) return null;

    const isAdmin = String(user?.role || "").toLowerCase() === "admin";
    const orgId = isAdmin ? "" : asTrimmedString(user?.ckan_org_id);
    if (!isAdmin && !orgId) return null;

    const limit = 100;
    let page = 1;

    while (page <= 20) {
      const result = await listDatasets({ orgId, page, limit });
      const datasets = Array.isArray(result?.datasets) ? result.datasets : [];
      if (!datasets.length) break;

      for (const dataset of datasets) {
        const resources = Array.isArray(dataset?.resources)
          ? dataset.resources
          : [];
        const resource = resources.find(
          (row) => asTrimmedString(row?.id) === id,
        );
        if (resource) return { dataset, resource };
      }

      const total = Number(result?.count || 0);
      if (datasets.length < limit || (total > 0 && page * limit >= total)) {
        break;
      }
      page += 1;
    }

    return null;
  }

  app.get(
    "/api/submissions/mine/research-outputs",
    authMiddleware,
    async (req, res) => {
      try {
        // Non-admins are scoped by CKAN org; admins can view all.
        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        const orgId = isAdmin ? "" : asTrimmedString(req.user?.ckan_org_id);
        const page = Math.max(1, Number(req.query?.page || 1));
        const limit = Math.max(
          1,
          Math.min(100, Number(req.query?.limit || 100)),
        );
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

          // Flatten each dataset resource into table-friendly response rows.
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
              created_at:
                resource?.created || dataset?.metadata_created || null,
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

  app.get(
    "/api/submissions/:projectId/editable",
    authMiddleware,
    async (req, res) => {
      try {
        const projectId = asTrimmedString(req.params?.projectId);
        if (!projectId) return badRequest(res, "Project id is required.");

        const dataset = await getDataset(projectId);
        if (!dataset) {
          return res.status(404).json({ error: "Project dataset not found." });
        }

        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        if (!isAdmin && !isDatasetOwnedByUser(dataset, req.user)) {
          return res.status(403).json({
            error: "You are not allowed to edit this project.",
          });
        }

        return res.json({ data: mapDatasetToEditableForm(dataset) });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to load editable submission.",
          ),
        });
      }
    },
  );

  app.get(
    "/api/submissions/:projectId/expected-outputs",
    authMiddleware,
    async (req, res) => {
      try {
        const projectId = asTrimmedString(req.params?.projectId);
        if (!projectId) return badRequest(res, "Project id is required.");

        const dataset = await getDataset(projectId);
        if (!dataset) {
          return res.status(404).json({ error: "Project dataset not found." });
        }

        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        if (!isAdmin && !isDatasetOwnedByUser(dataset, req.user)) {
          return res.status(403).json({
            error: "You are not allowed to view this project outputs.",
          });
        }

        return res.json({ data: mapResourcesToExpectedOutputs(dataset) });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load expected outputs."),
        });
      }
    },
  );

  app.post("/api/submissions/publish", authMiddleware, async (req, res) => {
    // Accepts both create and update flow depending on `dataset_id`.
    const form = req.body?.form || {};
    const expectedOutputs = Array.isArray(req.body?.expected_outputs)
      ? req.body.expected_outputs
      : [];
    const datasetId = asTrimmedString(req.body?.dataset_id);

    const title = asTrimmedString(form.title);
    if (!title) return badRequest(res, "Project title is required.");

    const notes = asTrimmedString(form.abstract);
    const supportingMovLink = asTrimmedString(form.supporting_mov_link);
    const fallbackResourceUrl =
      supportingMovLink || `${config.ckanBaseUrl}/dataset`;

    let dataset = null;
    const createdNow = !datasetId;
    try {
      const existingDataset = datasetId ? await getDataset(datasetId) : null;
      if (datasetId && !existingDataset) {
        return res.status(404).json({ error: "Dataset not found." });
      }

      const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
      if (
        existingDataset &&
        !isAdmin &&
        !isDatasetOwnedByUser(existingDataset, req.user)
      ) {
        return res.status(403).json({
          error: "You are not allowed to edit this project.",
        });
      }

      const ownerOrg =
        asTrimmedString(form.research_center_id) ||
        asTrimmedString(existingDataset?.owner_org) ||
        asTrimmedString(req.user?.ckan_org_id);
      if (!ownerOrg) {
        return badRequest(
          res,
          "Research center (CKAN organization) is required.",
        );
      }

      let extras = toDatasetExtras(form, req.user);
      if (existingDataset) {
        const existingExtras = Array.isArray(existingDataset?.extras)
          ? existingDataset.extras
          : [];
        // Preserve original submitter/ownership metadata during edits.
        for (const key of [
          "submitted_by_user_id",
          "submitted_by_email",
          "submitted_by_name",
          "submitted_by_role",
          "submitted_at",
          "submission_trace_id",
        ]) {
          const value = asTrimmedString(getExtraByKey(existingExtras, key));
          if (value) extras = upsertExtra(extras, key, value);
        }
      }

      const baseDatasetPayload = {
        name: asTrimmedString(existingDataset?.name) || toCkanName(title),
        title,
        notes,
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
        private: existingDataset ? Boolean(existingDataset?.private) : true,
        // Preserve searchable categorical tags from key form fields.
        tags: [
          asTrimmedString(form.classification),
          asTrimmedString(form.status),
          asTrimmedString(form.scholarly_type),
        ]
          .filter(Boolean)
          .map((value) => ({
            name: value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          })),
        extras,
      };

      // Update existing dataset when dataset id is supplied, otherwise create new one.
      dataset = datasetId
        ? await updateDataset({ ...baseDatasetPayload, id: datasetId })
        : await createDataset(baseDatasetPayload);

      if (datasetId) {
        const current = await getDataset(
          dataset?.id || dataset?.name || datasetId,
        );
        const existingResources = Array.isArray(current?.resources)
          ? current.resources
          : [];
        for (const resource of existingResources) {
          const resourceId = asTrimmedString(resource?.id);
          if (!resourceId) continue;
          await deleteDatasetResource(resourceId);
        }
      }

      const createdResources = [];
      for (let i = 0; i < expectedOutputs.length; i += 1) {
        const row = expectedOutputs[i] || {};
        const name = formatOutputResourceName(row, i);
        const description = asTrimmedString(row.notes);
        const fileName =
          asTrimmedString(row.file_name) || asTrimmedString(row.fileName) || "";
        const mimeType =
          asTrimmedString(row.mime_type) || asTrimmedString(row.mimeType) || "";
        const fileSize = Number(row.file_size || row.fileSize || 0);
        const filePath =
          asTrimmedString(row.file_path) || asTrimmedString(row.filePath) || "";
        const url =
          /^https?:\/\//i.test(filePath) || String(filePath).startsWith("blob:")
            ? filePath
            : fallbackResourceUrl;
        // Infer format from filename extension when explicit format is missing.
        const format = fileName.includes(".")
          ? fileName.split(".").pop()?.toUpperCase() || ""
          : "";

        const resource = await createDatasetResource({
          package_id: dataset.id || dataset.name,
          name,
          description: description || null,
          url,
          format: format || null,
          mimetype: mimeType || null,
          size: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null,
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
          // Roll back orphan dataset when resource creation fails mid-request.
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

  app.patch(
    "/api/submissions/:projectId/owner-edit",
    authMiddleware,
    async (req, res) => {
      try {
        const projectId = asTrimmedString(req.params?.projectId);
        if (!projectId) {
          return badRequest(res, "Project id is required.");
        }

        const form = req.body?.form || {};
        const dataset = await getDataset(projectId);
        if (!dataset) {
          return res.status(404).json({ error: "Project dataset not found." });
        }
        const extrasRows = Array.isArray(dataset?.extras) ? dataset.extras : [];

        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        if (!isAdmin && !isDatasetOwnedByUser(dataset, req.user)) {
          return res.status(403).json({
            error: "You are not allowed to edit this project.",
          });
        }

        const nextTitle =
          asTrimmedString(form.title) || dataset?.title || dataset?.name;
        if (!nextTitle) {
          return badRequest(res, "Project title is required.");
        }

        const currentYear = asTrimmedString(
          getExtraByKey(extrasRows, "project_year") ||
            getExtraByKey(extrasRows, "year"),
        );
        const currentIndustryPartner = asTrimmedString(
          getExtraByKey(extrasRows, "industry_partner"),
        );
        const currentFundingSource = asTrimmedString(
          getExtraByKey(extrasRows, "funding_source"),
        );
        const currentFundingAmount = asTrimmedString(
          getExtraByKey(extrasRows, "funding_amount"),
        );
        const currentStartDate = asTrimmedString(
          getExtraByKey(extrasRows, "start_date"),
        );
        const currentEndDate = asTrimmedString(
          getExtraByKey(extrasRows, "end_date"),
        );

        const nextYear = asTrimmedString(form.year) || currentYear;
        const nextIndustryPartner =
          asTrimmedString(form.industry_partner) || currentIndustryPartner;
        const nextFundingSource =
          asTrimmedString(form.funding_source) || currentFundingSource;
        const nextFundingAmount =
          asTrimmedString(form.funding_amount) || currentFundingAmount;
        const nextStartDate =
          asTrimmedString(form.start_date) || currentStartDate;
        const nextEndDate = asTrimmedString(form.end_date) || currentEndDate;
        const nextAbstract =
          asTrimmedString(form.abstract) || dataset?.notes || "";

        let extras = extrasRows;
        extras = upsertExtra(extras, "project_year", nextYear);
        extras = upsertExtra(extras, "industry_partner", nextIndustryPartner);
        extras = upsertExtra(extras, "funding_source", nextFundingSource);
        extras = upsertExtra(extras, "funding_amount", nextFundingAmount);
        extras = upsertExtra(extras, "start_date", nextStartDate);
        extras = upsertExtra(extras, "end_date", nextEndDate);

        const updated = await updateDataset({
          ...dataset,
          id: dataset?.id || projectId,
          title: nextTitle,
          notes: nextAbstract,
          extras,
        });

        return res.json({
          data: {
            id: updated?.id || dataset?.id || projectId,
            ckan_dataset_id: updated?.id || dataset?.id || projectId,
            title: updated?.title || nextTitle,
            abstract: updated?.notes || nextAbstract,
            year:
              getExtraByKey(updated?.extras, "project_year") ||
              getExtraByKey(updated?.extras, "year") ||
              nextYear ||
              "-",
            industry_partner:
              getExtraByKey(updated?.extras, "industry_partner") ||
              nextIndustryPartner ||
              "",
            funding_source:
              getExtraByKey(updated?.extras, "funding_source") ||
              nextFundingSource ||
              "",
            funding_amount:
              getExtraByKey(updated?.extras, "funding_amount") ||
              nextFundingAmount ||
              "0",
            start_date:
              getExtraByKey(updated?.extras, "start_date") ||
              nextStartDate ||
              "",
            end_date:
              getExtraByKey(updated?.extras, "end_date") || nextEndDate || "",
            updated_at: updated?.metadata_modified || new Date().toISOString(),
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to update project."),
        });
      }
    },
  );

  app.delete(
    "/api/submissions/:projectId",
    authMiddleware,
    async (req, res) => {
      try {
        const projectId = asTrimmedString(req.params?.projectId);
        if (!projectId) {
          return badRequest(res, "Project id is required.");
        }

        const dataset = await getDataset(projectId);
        if (!dataset) {
          return res.status(404).json({ error: "Project dataset not found." });
        }

        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        if (!isAdmin && !isDatasetOwnedByUser(dataset, req.user)) {
          return res.status(403).json({
            error: "You are not allowed to delete this project.",
          });
        }

        await deleteDataset(projectId);
        return res.json({
          data: {
            id: projectId,
            deleted: true,
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to delete project."),
        });
      }
    },
  );

  app.patch(
    "/api/submissions/datasets/:datasetId/visibility",
    authMiddleware,
    async (req, res) => {
      try {
        const datasetId = asTrimmedString(req.params?.datasetId);
        if (!datasetId) {
          return badRequest(res, "Dataset id is required.");
        }

        const isPublic = req.body?.isPublic;
        if (typeof isPublic !== "boolean") {
          return badRequest(res, "isPublic must be a boolean.");
        }

        const dataset = await getDataset(datasetId);
        if (!dataset) {
          return res.status(404).json({ error: "Dataset not found." });
        }

        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        if (!isAdmin && !isDatasetOwnedByUser(dataset, req.user)) {
          return res.status(403).json({
            error: "You are not allowed to update this dataset visibility.",
          });
        }

        const updated = await setDatasetVisibility({
          datasetId,
          isPrivate: !isPublic,
        });

        return res.json({
          data: {
            dataset_id: updated?.id || datasetId,
            project_public_visible: !Boolean(updated?.private),
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(
            error?.message || "Failed to update dataset visibility.",
          ),
        });
      }
    },
  );

  app.patch(
    "/api/submissions/resources/:resourceId",
    authMiddleware,
    async (req, res) => {
      try {
        const resourceId = asTrimmedString(req.params?.resourceId);
        if (!resourceId) {
          return badRequest(res, "Resource id is required.");
        }

        const located = await findDatasetByResourceId(resourceId, req.user);
        if (!located?.dataset || !located?.resource) {
          return res.status(404).json({ error: "Resource not found." });
        }

        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        if (!isAdmin && !isDatasetOwnedByUser(located.dataset, req.user)) {
          return res.status(403).json({
            error: "You are not allowed to edit this resource.",
          });
        }

        const hasName = Object.prototype.hasOwnProperty.call(
          req.body || {},
          "file_name",
        );
        const hasNotes = Object.prototype.hasOwnProperty.call(
          req.body || {},
          "notes",
        );
        const hasPath = Object.prototype.hasOwnProperty.call(
          req.body || {},
          "file_path",
        );
        const hasMime = Object.prototype.hasOwnProperty.call(
          req.body || {},
          "mime_type",
        );
        const hasSize = Object.prototype.hasOwnProperty.call(
          req.body || {},
          "file_size",
        );

        if (!hasName && !hasNotes && !hasPath && !hasMime && !hasSize) {
          return badRequest(res, "At least one editable field is required.");
        }

        const nextName = hasName
          ? asTrimmedString(req.body?.file_name)
          : asTrimmedString(located.resource?.name);
        const nextNotesRaw = hasNotes
          ? asTrimmedString(req.body?.notes)
          : asTrimmedString(located.resource?.description);
        const nextPath = hasPath
          ? asTrimmedString(req.body?.file_path)
          : asTrimmedString(located.resource?.url);
        const nextMime = hasMime
          ? asTrimmedString(req.body?.mime_type)
          : asTrimmedString(
              located.resource?.mimetype || located.resource?.format,
            );
        const nextSize = hasSize
          ? asNumber(req.body?.file_size, 0)
          : asNumber(located.resource?.size, 0);

        const updated = await updateDatasetResource({
          id: resourceId,
          package_id: located.dataset?.id || located.dataset?.name || null,
          name: nextName || null,
          description: nextNotesRaw || null,
          url: nextPath || null,
          mimetype: nextMime || null,
          size: Number.isFinite(nextSize) && nextSize > 0 ? nextSize : null,
        });

        return res.json({
          data: {
            resource_id: updated?.id || resourceId,
            dataset_id: located.dataset?.id || null,
            file_name: updated?.name || nextName || null,
            notes: updated?.description || nextNotesRaw || null,
            file_path: updated?.url || nextPath || null,
            mime_type: updated?.mimetype || updated?.format || nextMime || null,
            file_size:
              updated?.size ??
              (Number.isFinite(nextSize) && nextSize > 0 ? nextSize : null),
            updated_at:
              updated?.last_modified ||
              updated?.metadata_modified ||
              new Date().toISOString(),
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to update resource."),
        });
      }
    },
  );

  app.delete(
    "/api/submissions/resources/:resourceId",
    authMiddleware,
    async (req, res) => {
      try {
        const resourceId = asTrimmedString(req.params?.resourceId);
        if (!resourceId) {
          return badRequest(res, "Resource id is required.");
        }

        const located = await findDatasetByResourceId(resourceId, req.user);
        if (!located?.dataset || !located?.resource) {
          return res.status(404).json({ error: "Resource not found." });
        }

        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        if (!isAdmin && !isDatasetOwnedByUser(located.dataset, req.user)) {
          return res.status(403).json({
            error: "You are not allowed to delete this resource.",
          });
        }

        await deleteDatasetResource(resourceId);
        return res.json({
          data: {
            resource_id: resourceId,
            dataset_id: located.dataset?.id || null,
            deleted: true,
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to delete resource."),
        });
      }
    },
  );
}
