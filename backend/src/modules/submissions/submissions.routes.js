import crypto from "node:crypto";

export function registerSubmissionsRoutes(app, deps) {
  const {
    authMiddleware,
    badRequest,
    config,
    asTrimmedString,
    asNumber,
    listDatasets,
    createDataset,
    updateDataset,
    deleteDataset,
    createDatasetResource,
    getExtraByKey,
  } = deps;

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

  app.get(
    "/api/submissions/mine/research-outputs",
    authMiddleware,
    async (req, res) => {
      try {
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
      return badRequest(
        res,
        "Research center (CKAN organization) is required.",
      );
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
        const mimeType =
          asTrimmedString(row.mime_type) || asTrimmedString(row.mimeType) || "";
        const fileSize = Number(row.file_size || row.fileSize || 0);
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
}
