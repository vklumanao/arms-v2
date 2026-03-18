import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { ckanAction } from "../../integrations/ckan/http/ckanAction.js";

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
      parseOrThrow,
      projectSubmissionPublishSchema,
      projectSubmissionDraftSchema,
      config,
    asTrimmedString,
    asNumber,
    listDatasets,
    getDataset,
    getOrganization,
    createDataset,
    updateDataset,
    setDatasetVisibility,
    deleteDataset,
    createDatasetResource,
    createDatasetResourceUpload,
    updateDatasetResource,
    deleteDatasetResource,
    getExtraByKey,
    } = deps;

    function resolveCkanResourceUrl(resourceUrl) {
      const raw = asTrimmedString(resourceUrl);
      if (!raw) return "";
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
          const parsed = new URL(raw);
          const ckanBase = new URL(`${config.ckanBaseUrl}/`);
          const isLocalHost =
            parsed.hostname === "localhost" ||
            parsed.hostname === "127.0.0.1" ||
            parsed.hostname === "ckan";
          if (isLocalHost) {
            return new URL(
              `${parsed.pathname}${parsed.search}`,
              `${ckanBase.origin}/`,
            ).toString();
          }
        } catch {
          return raw;
        }
        return raw;
      }
      if (raw.startsWith("/")) {
        return new URL(raw, `${config.ckanBaseUrl}/`).toString();
      }
      return new URL(raw, `${config.ckanBaseUrl}/`).toString();
    }

    function isPlaceholderResourceUrl(url) {
      const raw = asTrimmedString(url);
      if (!raw) return false;
      if (raw.includes("/resource/")) return false;
      return raw.includes("/dataset");
    }

    function buildDownloadFilename(resource = {}, fallbackUrl = "") {
      const name = asTrimmedString(resource?.name);
      if (name) return name.replace(/["\\]/g, "_");
      try {
        const url = new URL(fallbackUrl);
        const basename = path.basename(url.pathname || "");
        return basename || "resource.bin";
      } catch {
        return "resource.bin";
      }
    }

    function proxyDownload({ sourceUrl, res, inline, filename, mimeType }) {
      const maxRedirects = 5;
      const requestUrl = (url, redirectsLeft) =>
        new Promise((resolve, reject) => {
          const parsed = new URL(url);
          const transport = parsed.protocol === "https:" ? https : http;
          const options = {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
            path: `${parsed.pathname}${parsed.search}`,
            method: "GET",
            headers: {
              Accept: "*/*",
              Authorization: config.ckanApiKey,
              "X-CKAN-API-Key": config.ckanApiKey,
            },
          };

          if (parsed.protocol === "https:") {
            options.rejectUnauthorized = config.ckanVerifyTls;
          }

          const req = transport.request(options, (upstream) => {
            const status = upstream.statusCode || 0;
            const location = upstream.headers?.location;
            if (
              status >= 300 &&
              status < 400 &&
              location &&
              redirectsLeft > 0
            ) {
              upstream.resume();
              const nextUrl = new URL(location, url).toString();
              resolve(requestUrl(nextUrl, redirectsLeft - 1));
              return;
            }

            if (status >= 400) {
              const chunks = [];
              upstream.on("data", (chunk) => chunks.push(chunk));
              upstream.on("end", () => {
                const message =
                  Buffer.concat(chunks).toString("utf8") ||
                  `Upstream download failed with status ${status}`;
                if (!res.headersSent) {
                  res
                    .status(status)
                    .json({ error: message.slice(0, 300) });
                }
                resolve();
              });
              upstream.on("error", reject);
              return;
            }

            if (!res.headersSent) {
              const dispositionType = inline ? "inline" : "attachment";
              const safeName = filename || "resource.bin";
              res.setHeader(
                "Content-Disposition",
                `${dispositionType}; filename="${safeName}"`,
              );
              if (mimeType) {
                res.setHeader("Content-Type", mimeType);
              } else if (upstream.headers?.["content-type"]) {
                res.setHeader("Content-Type", upstream.headers["content-type"]);
              }
              if (upstream.headers?.["content-length"]) {
                res.setHeader(
                  "Content-Length",
                  upstream.headers["content-length"],
                );
              }
              if (upstream.headers?.etag) {
                res.setHeader("ETag", upstream.headers.etag);
              }
              if (upstream.headers?.["last-modified"]) {
                res.setHeader("Last-Modified", upstream.headers["last-modified"]);
              }
            }

            res.status(status || 200);
            upstream.pipe(res);
            upstream.on("end", resolve);
            upstream.on("error", reject);
          });

          req.on("error", reject);
          req.end();
        });

      return requestUrl(sourceUrl, maxRedirects);
    }

  const ALLOWED_OUTPUT_TYPES = new Set([
    "publication",
    "patent_ip",
    "people_services",
    "places_partnerships",
    "policies",
    "product_software",
    "others",
  ]);
  const MAX_OUTPUT_UPLOAD_BYTES = 25 * 1024 * 1024;
  const SUBMISSION_STATE_DRAFT = "draft";
  const SUBMISSION_STATE_SUBMITTED = "submitted";

  function getSubmissionStateFromExtras(extras = []) {
    const raw = asTrimmedString(getExtraByKey(extras, "submission_state"))
      .trim()
      .toLowerCase();
    return raw === SUBMISSION_STATE_DRAFT ? SUBMISSION_STATE_DRAFT : SUBMISSION_STATE_SUBMITTED;
  }

  function parseDraftExpectedOutputs(extras = []) {
    const raw = asTrimmedString(
      getExtraByKey(extras, "draft_expected_outputs_json"),
    );
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function normalizeDraftExpectedOutputs(rows = []) {
    const items = Array.isArray(rows) ? rows : [];
    return items
      .map((row, index) => {
        const outputType = asTrimmedString(row?.output_type || row?.outputType);
        if (!ALLOWED_OUTPUT_TYPES.has(outputType)) return null;
        const targetCount = Math.max(
          1,
          Number(row?.target_count || row?.targetCount || 1) || 1,
        );
        return {
          id:
            asTrimmedString(row?.id) ||
            asTrimmedString(row?.client_id) ||
            `draft-output-${index + 1}`,
          output_type: outputType,
          target_count: targetCount,
          specific_output: asTrimmedString(row?.specific_output || row?.specificOutput),
          notes: asTrimmedString(row?.notes),
          file_path: asTrimmedString(row?.file_path || row?.filePath),
          file_name: asTrimmedString(row?.file_name || row?.fileName),
          mime_type: asTrimmedString(row?.mime_type || row?.mimeType),
          file_size: Number(row?.file_size || row?.fileSize || 0) || null,
        };
      })
      .filter(Boolean);
  }

  function serializeSelectedUsers(items = []) {
    return JSON.stringify(
      (Array.isArray(items) ? items : [])
        .map((row) => ({
          id: asTrimmedString(row?.id),
          name: asTrimmedString(row?.name),
          username: asTrimmedString(row?.username),
          email: asTrimmedString(row?.email).toLowerCase(),
          role: asTrimmedString(row?.role).toLowerCase(),
        }))
        .filter(
          (row) => row.id || row.name || row.username || row.email || row.role,
        ),
    );
  }

  function parseSelectedUsers(rawValue) {
    try {
      const parsed = JSON.parse(asTrimmedString(rawValue) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => ({
          id: asTrimmedString(row?.id),
          name: asTrimmedString(row?.name),
          username: asTrimmedString(row?.username),
          email: asTrimmedString(row?.email).toLowerCase(),
          role: asTrimmedString(row?.role).toLowerCase(),
        }))
        .filter(
          (row) => row.id || row.name || row.username || row.email || row.role,
        );
    } catch {
      return [];
    }
  }

  function serializeExpectedOutputMetadata(items = []) {
    return JSON.stringify(
      (Array.isArray(items) ? items : [])
        .map((row) => ({
          output_type: normalizeOutputType(row?.output_type || row?.outputType),
          target_count: Math.max(
            1,
            Number(row?.target_count || row?.targetCount || 1) || 1,
          ),
          specific_output: asTrimmedString(
            row?.specific_output || row?.specificOutput,
          ),
        }))
        .filter((row) => row.output_type),
    );
  }

  function parseExpectedOutputMetadata(rawValue) {
    try {
      const parsed = JSON.parse(asTrimmedString(rawValue) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => ({
          output_type: normalizeOutputType(row?.output_type || row?.outputType),
          target_count: Math.max(
            1,
            Number(row?.target_count || row?.targetCount || 1) || 1,
          ),
          specific_output: asTrimmedString(
            row?.specific_output || row?.specificOutput,
          ),
        }))
        .filter((row) => row.output_type);
    } catch {
      return [];
    }
  }

  function isDatasetLinkedToFacultyUser(dataset, user) {
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const selectedUsers = parseSelectedUsers(
      getExtraByKey(extras, "faculty_team_users"),
    );
    if (!selectedUsers.length) return false;

    const userId = asTrimmedString(user?.ckan_user_id || user?.id);
    const username = asTrimmedString(user?.ckan_username);
    const email = asTrimmedString(user?.email).toLowerCase();

    return selectedUsers.some(
      (row) =>
        (userId && asTrimmedString(row?.id) === userId) ||
        (username &&
          asTrimmedString(row?.username).toLowerCase() ===
            username.toLowerCase()) ||
        (email && asTrimmedString(row?.email).toLowerCase() === email),
    );
  }

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

    function buildUniqueCkanName(baseName) {
      const safeBase = asTrimmedString(baseName) || "dataset";
      const suffix = crypto.randomUUID().slice(0, 8);
      const maxBaseLength = Math.max(1, 80 - suffix.length - 1);
      const trimmedBase = safeBase.slice(0, maxBaseLength);
      return `${trimmedBase}-${suffix}`;
    }

    async function createDatasetWithUniqueName(payload) {
      const baseName = asTrimmedString(payload?.name) || toCkanName(payload?.title);
      let attemptName = baseName;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await createDataset({ ...payload, name: attemptName });
        } catch (error) {
          lastError = error;
          const message = String(error?.message || "").toLowerCase();
          const urlConflict =
            message.includes("already in use") ||
            message.includes("validation error") ||
            message.includes("url");
          if (!urlConflict) throw error;
          attemptName = buildUniqueCkanName(baseName);
        }
      }
      throw lastError || new Error("Unable to create dataset.");
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

  function normalizeOutputType(value) {
    const rawType = asTrimmedString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return rawType === "patent" || rawType === "ip"
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

    const buffer = Buffer.from(base64Payload, "base64");
    return { buffer, mimeType };
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
        key: "lead_researcher_user",
        value: serializeSelectedUsers(
          form.lead_researcher_user ? [form.lead_researcher_user] : [],
        ),
      },
      {
        key: "faculty_team",
        value: asTrimmedString(form.faculty_team) || null,
      },
      {
        key: "faculty_team_users",
        value: serializeSelectedUsers(form.faculty_team_users),
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
        key: "expected_outputs_meta",
        value: serializeExpectedOutputMetadata(form.expected_outputs_items),
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

  function getDatasetTagNames(dataset) {
    const tags = Array.isArray(dataset?.tags) ? dataset.tags : [];
    return tags
      .map((tag) => asTrimmedString(tag?.name || tag?.display_name || tag))
      .filter(Boolean);
  }

  async function isCenterChiefForDataset(dataset, user) {
    const orgId =
      asTrimmedString(dataset?.organization?.name) ||
      asTrimmedString(dataset?.owner_org);
    const userCkanId = asTrimmedString(user?.ckan_user_id);
    if (!orgId || !userCkanId) return false;
    try {
      const org = await getOrganization(orgId);
      const extras = Array.isArray(org?.extras) ? org.extras : [];
      const centerChiefId = asTrimmedString(
        getExtraByKey(extras, "center_chief_id"),
      );
      if (!centerChiefId) return false;
      return centerChiefId === userCkanId;
    } catch {
      return false;
    }
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
    const submission_state = getSubmissionStateFromExtras(extras);
    const tagNames = getDatasetTagNames(dataset);
    const yearFromExtra = asTrimmedString(
      getExtraByKey(extras, "project_year") || getExtraByKey(extras, "year"),
    );
    const createdYear = new Date(
      dataset?.metadata_created || dataset?.metadata_modified || 0,
    ).getFullYear();
    const draftPublicVisible = asTrimmedString(
      getExtraByKey(extras, "draft_public_visible"),
    )
      .trim()
      .toLowerCase();
    const draftStepRaw = asTrimmedString(getExtraByKey(extras, "draft_step"));
    const draftStep = Math.max(0, Number(draftStepRaw || 0) || 0);

    return {
      id: dataset?.id || dataset?.name || null,
      submission_state,
      draft_step: submission_state === SUBMISSION_STATE_DRAFT ? draftStep : null,
      title: asTrimmedString(dataset?.title || dataset?.name),
      lead_researcher: asTrimmedString(
        getExtraByKey(extras, "lead_researcher"),
      ),
      lead_researcher_user:
        parseSelectedUsers(getExtraByKey(extras, "lead_researcher_user"))[0] ||
        null,
      lead_researcher_user:
        parseSelectedUsers(getExtraByKey(extras, "lead_researcher_user"))[0] ||
        null,
      faculty_team: asTrimmedString(getExtraByKey(extras, "faculty_team")),
      faculty_team_users: parseSelectedUsers(
        getExtraByKey(extras, "faculty_team_users"),
      ),
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
        getExtraByKey(extras, "research_agenda_id") ||
          getExtraByKey(extras, "agenda_id"),
      ),
      department_id: asTrimmedString(
        getExtraByKey(extras, "department_id") ||
          getExtraByKey(extras, "program_department") ||
          getExtraByKey(extras, "department"),
      ),
      scholarly_type: asTrimmedString(
        getExtraByKey(extras, "scholarly_type"),
      ),
      funding_type:
        asTrimmedString(getExtraByKey(extras, "funding_type")) ||
        (tagNames.includes("internal")
          ? "internal"
          : tagNames.includes("external")
            ? "external"
            : tagNames.includes("self_funded")
              ? "self_funded"
              : "none"),
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
        asTrimmedString(getExtraByKey(extras, "classification")) ||
        (tagNames.includes("industry") ? "industry" : "academic"),
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
      public_visible:
        submission_state === SUBMISSION_STATE_DRAFT &&
        (draftPublicVisible === "true" || draftPublicVisible === "false")
          ? draftPublicVisible === "true"
          : !Boolean(dataset?.private),
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
      "others",
    ]);
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const metadataRows = parseExpectedOutputMetadata(
      getExtraByKey(extras, "expected_outputs_meta"),
    );
    const resources = Array.isArray(dataset?.resources)
      ? dataset.resources
      : [];
    return resources.map((resource, index) => {
      const name = asTrimmedString(resource?.name);
      const targetMatch = name.match(/\(target:\s*(\d+)\)/i);
      const targetCount = Math.max(1, Number(targetMatch?.[1] || 1) || 1);
      const rawType = name.replace(/\s*\(target:[^)]+\)\s*$/i, "").trim();
      const normalizedType = normalizeOutputType(rawType);
      const metadata = metadataRows[index] || null;
      const outputType = metadata?.output_type || normalizedType;

      return {
        id: resource?.id || `resource-${index + 1}`,
        output_type: allowedOutputTypes.has(outputType)
          ? outputType
          : "publication",
        target_count: metadata?.target_count || targetCount,
        specific_output: asTrimmedString(metadata?.specific_output),
        notes: asTrimmedString(resource?.description),
        file_path: asTrimmedString(resource?.url),
        file_name: asTrimmedString(resource?.name),
        mime_type: asTrimmedString(resource?.mimetype || resource?.format),
        file_size: Number(resource?.size || 0) || null,
      };
    });
  }

  function mapDatasetToProjectListRecord(dataset) {
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const submission_state = getSubmissionStateFromExtras(extras);
    const tagNames = getDatasetTagNames(dataset);
    const metadataCreated = asTrimmedString(dataset?.metadata_created);
    const createdYear = metadataCreated
      ? new Date(metadataCreated).getFullYear()
      : null;
    const yearFromExtra = asTrimmedString(
      getExtraByKey(extras, "project_year") || getExtraByKey(extras, "year"),
    );

    return {
      id: dataset?.id || dataset?.name || null,
      source: "ckan",
      ckan_dataset_id: dataset?.id || dataset?.name || null,
      submission_state,
      title: dataset?.title || dataset?.name || "Untitled project",
      abstract: asTrimmedString(dataset?.notes),
      lead_researcher: asTrimmedString(
        getExtraByKey(extras, "lead_researcher"),
      ),
      faculty_team: asTrimmedString(getExtraByKey(extras, "faculty_team")),
      faculty_team_users: parseSelectedUsers(
        getExtraByKey(extras, "faculty_team_users"),
      ),
      student_team: asTrimmedString(getExtraByKey(extras, "student_team")),
      industry_partner: asTrimmedString(
        getExtraByKey(extras, "industry_partner"),
      ),
      funding_source: asTrimmedString(getExtraByKey(extras, "funding_source")),
      funding_amount: asTrimmedString(getExtraByKey(extras, "funding_amount")),
      start_date: asTrimmedString(getExtraByKey(extras, "start_date")),
      end_date: asTrimmedString(getExtraByKey(extras, "end_date")),
      year:
        yearFromExtra ||
        (Number.isFinite(createdYear) && createdYear > 0
          ? String(createdYear)
          : "-"),
      status:
        asTrimmedString(getExtraByKey(extras, "project_status")) ||
        asTrimmedString(getExtraByKey(extras, "status")) ||
        (tagNames.find((tag) =>
          ["proposal", "ongoing", "completed", "rejected"].includes(tag),
        ) ||
          "ongoing"),
      classification:
        asTrimmedString(getExtraByKey(extras, "classification")) ||
        (tagNames.includes("industry") ? "industry" : "academic"),
      scholarly_type: asTrimmedString(getExtraByKey(extras, "scholarly_type")),
      department_id: asTrimmedString(
        getExtraByKey(extras, "department_id") ||
          getExtraByKey(extras, "program_department") ||
          getExtraByKey(extras, "department"),
      ),
      research_agenda_id: asTrimmedString(
        getExtraByKey(extras, "research_agenda_id") ||
          getExtraByKey(extras, "agenda_id"),
      ),
      funding_type:
        asTrimmedString(getExtraByKey(extras, "funding_type")) ||
        (tagNames.includes("internal")
          ? "internal"
          : tagNames.includes("external")
            ? "external"
            : tagNames.includes("self_funded")
              ? "self_funded"
              : "none"),
      funding_category: asTrimmedString(
        getExtraByKey(extras, "funding_category"),
      ),
      supporting_mov_link: asTrimmedString(
        getExtraByKey(extras, "supporting_mov_link"),
      ),
      signed_moa_reference: asTrimmedString(
        getExtraByKey(extras, "signed_moa_reference"),
      ),
      expected_outputs: asTrimmedString(
        getExtraByKey(extras, "expected_outputs_summary"),
      ),
      expected_outputs_items: parseExpectedOutputMetadata(
        getExtraByKey(extras, "expected_outputs_meta"),
      ),
      submitted_by_name:
        asTrimmedString(getExtraByKey(extras, "submitted_by_name")) ||
        asTrimmedString(dataset?.maintainer) ||
        asTrimmedString(dataset?.author) ||
        "CKAN Dataset Owner",
      submitted_by_email:
        asTrimmedString(getExtraByKey(extras, "submitted_by_email")) ||
        asTrimmedString(dataset?.maintainer_email) ||
        asTrimmedString(dataset?.author_email) ||
        "-",
      submitted_by:
        asTrimmedString(getExtraByKey(extras, "submitted_by_user_id")) ||
        asTrimmedString(dataset?.creator_user_id) ||
        null,
      project_author_email: asTrimmedString(dataset?.author_email) || null,
      submitted_at:
        metadataCreated || asTrimmedString(dataset?.metadata_modified) || null,
      submitted_by_org_name:
        asTrimmedString(dataset?.organization?.title) ||
        asTrimmedString(dataset?.organization?.display_name) ||
        asTrimmedString(dataset?.organization?.name) ||
        "-",
      project_public_visible: !Boolean(dataset?.private),
      public_visible: !Boolean(dataset?.private),
      private: Boolean(dataset?.private),
      project_ckan_org_id:
        asTrimmedString(dataset?.organization?.name) ||
        asTrimmedString(dataset?.owner_org) ||
        null,
      research_center_id:
        asTrimmedString(dataset?.organization?.name) ||
        asTrimmedString(dataset?.owner_org) ||
        null,
      resources: Array.isArray(dataset?.resources) ? dataset.resources : [],
    };
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
          if (!isAdmin && !isDatasetOwnedByUser(dataset, req.user)) continue;
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
            const resourceNameBase = asTrimmedString(resource?.name).replace(
              /\s*\(target:[^)]+\)\s*$/i,
              "",
            );
            const normalizedOutputType = normalizeOutputType(
              asTrimmedString(resource?.format) ||
                resourceNameBase ||
                "resource",
            );
            rows.push({
              id: resource?.id || `${dataset?.id || dataset?.name}-resource`,
              output_type: normalizedOutputType || "resource",
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
    "/api/submissions/mine/projects",
    authMiddleware,
    async (req, res) => {
      try {
        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        const orgId = isAdmin ? "" : asTrimmedString(req.user?.ckan_org_id);
        if (!isAdmin && !orgId) return res.json({ data: [] });

        const rows = [];
        const limit = 100;
        let page = 1;
        while (page <= 20) {
          const result = await listDatasets({ orgId, page, limit });
          const datasets = Array.isArray(result?.datasets)
            ? result.datasets
            : [];
          if (!datasets.length) break;

          for (const dataset of datasets) {
            if (!isAdmin && !isDatasetOwnedByUser(dataset, req.user)) continue;
            rows.push(mapDatasetToProjectListRecord(dataset));
          }

          const total = Number(result?.count || 0);
          if (datasets.length < limit || (total > 0 && page * limit >= total)) {
            break;
          }
          page += 1;
        }

        return res.json({ data: rows });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load user projects."),
        });
      }
    },
  );

  app.get(
    "/api/submissions/mine/linked-projects",
    authMiddleware,
    async (req, res) => {
      try {
        const rows = [];
        const limit = 100;
        let page = 1;

        while (page <= 20) {
          const result = await listDatasets({
            orgId: "",
            page,
            limit,
          });
          const datasets = Array.isArray(result?.datasets)
            ? result.datasets
            : [];
          if (!datasets.length) break;

          for (const dataset of datasets) {
            if (isDatasetOwnedByUser(dataset, req.user)) continue;
            if (!isDatasetLinkedToFacultyUser(dataset, req.user)) {
              continue;
            }
            rows.push(mapDatasetToProjectListRecord(dataset));
          }

          const total = Number(result?.count || 0);
          if (datasets.length < limit || (total > 0 && page * limit >= total)) {
            break;
          }
          page += 1;
        }

        return res.json({ data: rows });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load linked projects."),
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

        const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
        const submissionState = getSubmissionStateFromExtras(extras);
        if (submissionState === SUBMISSION_STATE_DRAFT) {
          const draftRows = normalizeDraftExpectedOutputs(
            parseDraftExpectedOutputs(extras),
          );
          if (draftRows.length > 0) {
            return res.json({ data: draftRows });
          }
        }

          return res.json({ data: mapResourcesToExpectedOutputs(dataset) });
        } catch (error) {
          return res.status(500).json({
            error: String(error?.message || "Failed to load expected outputs."),
          });
        }
      },
    );

    app.get(
      "/api/submissions/:projectId/resources",
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
          const isCenterChief = await isCenterChiefForDataset(dataset, req.user);
          if (
            !isAdmin &&
            !isCenterChief &&
            !isDatasetOwnedByUser(dataset, req.user)
          ) {
            return res.status(403).json({
              error: "You are not allowed to view this project resources.",
            });
          }

          return res.json({
            data: {
              dataset,
              resources: Array.isArray(dataset?.resources)
                ? dataset.resources
                : [],
            },
            syncEnabled: true,
          });
        } catch (error) {
          return res.status(500).json({
            error: String(error?.message || "Failed to load project resources."),
          });
        }
      },
    );

    app.get(
      "/api/submissions/resources/:resourceId/download",
      authMiddleware,
      async (req, res) => {
        try {
          const resourceId = asTrimmedString(req.params?.resourceId);
          if (!resourceId) return badRequest(res, "Resource id is required.");

          const located = await findDatasetByResourceId(resourceId, req.user);
          if (!located?.dataset || !located?.resource) {
            return res.status(404).json({ error: "Resource not found." });
          }
          const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
          const isCenterChief = await isCenterChiefForDataset(
            located.dataset,
            req.user,
          );
          if (
            !isAdmin &&
            !isCenterChief &&
            !isDatasetOwnedByUser(located.dataset, req.user)
          ) {
            return res.status(403).json({
              error: "You are not allowed to download this resource.",
            });
          }

          const ckanResource = await ckanAction("resource_show", {
            id: resourceId,
          });
          const datasetId =
            asTrimmedString(ckanResource?.package_id) ||
            asTrimmedString(located.dataset?.id) ||
            asTrimmedString(located.dataset?.name) ||
            "";
          const resourceUrlRaw = resolveCkanResourceUrl(ckanResource?.url);
          const resourceName = buildDownloadFilename(
            ckanResource,
            resourceUrlRaw,
          );
          const resourceMimeType = asTrimmedString(ckanResource?.mimetype);
          const hasDownloadUrl = /\/resource\/.+\/download\//i.test(
            String(resourceUrlRaw || ""),
          );
          const resourceUrl =
            hasDownloadUrl && resourceUrlRaw
              ? resourceUrlRaw
              : datasetId && resourceId
                ? `${config.ckanBaseUrl}/dataset/${datasetId}/resource/${resourceId}/download/${encodeURIComponent(
                    resourceName,
                  )}`
                : resourceUrlRaw;
          if (!resourceUrl) {
            return res.status(404).json({ error: "Resource URL is missing." });
          }

          const isDownload =
            String(req.query?.download || "").toLowerCase() === "1" ||
            String(req.query?.download || "").toLowerCase() === "true";
          const filename = resourceName;

          await proxyDownload({
            sourceUrl: resourceUrl,
            res,
            inline: !isDownload,
            filename,
            mimeType: resourceMimeType || null,
          });
        } catch (error) {
          if (res.headersSent) return;
          return res.status(500).json({
            error: String(error?.message || "Failed to download resource."),
          });
        }
      },
    );

  app.post("/api/submissions/draft", authMiddleware, async (req, res) => {
    let parsedRequest;
    try {
      parsedRequest = parseOrThrow(
        projectSubmissionDraftSchema,
        req.body || {},
        "Draft payload is invalid.",
      );
    } catch (error) {
      return badRequest(
        res,
        String(error?.message || "Draft payload is invalid."),
      );
    }

    const form =
      parsedRequest?.form && typeof parsedRequest.form === "object"
        ? parsedRequest.form
        : {};
    const datasetId = asTrimmedString(parsedRequest?.dataset_id);
    const expectedOutputsRaw = Array.isArray(parsedRequest?.expected_outputs)
      ? parsedRequest.expected_outputs
      : [];
    const expectedOutputs = normalizeDraftExpectedOutputs(expectedOutputsRaw);
    const draftStep = Math.max(
      0,
      Math.min(10, Number(parsedRequest?.draft_step || 0) || 0),
    );
    const nowIso = new Date().toISOString();

    try {
      const existingDataset = datasetId ? await getDataset(datasetId) : null;
      if (datasetId && !existingDataset) {
        return res.status(404).json({ error: "Dataset not found." });
      }

      if (existingDataset) {
        const extrasRows = Array.isArray(existingDataset?.extras)
          ? existingDataset.extras
          : [];
        const existingState = getSubmissionStateFromExtras(extrasRows);
        if (existingState !== SUBMISSION_STATE_DRAFT) {
          return res.status(409).json({
            error: "This project is already submitted and cannot be saved as a draft.",
          });
        }

        const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
        if (!isAdmin && !isDatasetOwnedByUser(existingDataset, req.user)) {
          return res.status(403).json({
            error: "You are not allowed to edit this draft.",
          });
        }
      }

      const ownerOrg =
        asTrimmedString(form?.research_center_id) ||
        asTrimmedString(existingDataset?.owner_org) ||
        asTrimmedString(req.user?.ckan_org_id);
      if (!ownerOrg) {
        return badRequest(
          res,
          "Research center (CKAN organization) is required to save a draft.",
        );
      }

      const title =
        asTrimmedString(form?.title) ||
        asTrimmedString(existingDataset?.title || existingDataset?.name) ||
        "Untitled Draft";
      const notes =
        asTrimmedString(form?.abstract) ||
        asTrimmedString(existingDataset?.notes) ||
        "";

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

      extras = upsertExtra(extras, "submission_state", SUBMISSION_STATE_DRAFT);
      extras = upsertExtra(extras, "draft_saved_at", nowIso);
      extras = upsertExtra(extras, "draft_step", String(draftStep));
      extras = upsertExtra(
        extras,
        "draft_public_visible",
        String(Boolean(form?.public_visible)),
      );
      extras = upsertExtra(
        extras,
        "draft_expected_outputs_json",
        JSON.stringify(expectedOutputs),
      );

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
        // Drafts are always private. Intended visibility is stored in extras.
        private: true,
        tags: [
          asTrimmedString(form?.classification),
          asTrimmedString(form?.status),
          asTrimmedString(form?.scholarly_type),
        ]
          .filter(Boolean)
          .map((value) => ({
            name: value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          })),
        extras,
      };

        const dataset = datasetId
          ? await updateDataset({ ...baseDatasetPayload, id: datasetId })
          : await createDatasetWithUniqueName(baseDatasetPayload);

      return res.status(datasetId ? 200 : 201).json({
        data: {
          id: dataset?.id || datasetId || null,
          name: dataset?.name || null,
          title: dataset?.title || title,
          submission_state: SUBMISSION_STATE_DRAFT,
          draft_saved_at: nowIso,
          draft_step: draftStep,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to save draft."),
      });
    }
  });

  app.post("/api/submissions/publish", authMiddleware, async (req, res) => {
    // Accepts both create and update flow depending on `dataset_id`.
    let parsedRequest;
    try {
      parsedRequest = parseOrThrow(
        projectSubmissionPublishSchema,
        req.body || {},
        "Submission payload is invalid.",
      );
    } catch (error) {
      return badRequest(
        res,
        String(error?.message || "Submission payload is invalid."),
      );
    }

    const form = parsedRequest.form || {};
    const expectedOutputs = Array.isArray(parsedRequest.expected_outputs)
      ? parsedRequest.expected_outputs
      : [];
    const datasetId = asTrimmedString(parsedRequest.dataset_id);
    const title = asTrimmedString(form.title);

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
      extras = upsertExtra(extras, "submission_state", SUBMISSION_STATE_SUBMITTED);

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
        private:
          typeof form.public_visible === "boolean"
            ? !form.public_visible
            : existingDataset
              ? Boolean(existingDataset?.private)
              : true,
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
          : await createDatasetWithUniqueName(baseDatasetPayload);

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
          const fileBase64 =
            asTrimmedString(row.file_base64) ||
            asTrimmedString(row.fileBase64) ||
            "";
          const hasRemoteFile =
            /^https?:\/\//i.test(filePath) || String(filePath).startsWith("blob:");
          const url =
            hasRemoteFile
              ? filePath
              : `${fallbackResourceUrl}?expected_output=${i + 1}&dataset=${
                  dataset.id || dataset.name || "unknown"
                }`;
          // Infer format from filename extension when explicit format is missing.
          const format = fileName.includes(".")
            ? fileName.split(".").pop()?.toUpperCase() || ""
            : "";

          let resource;
          if (fileBase64) {
            const { buffer, mimeType: mimeTypeFromData } =
              decodeBase64File(fileBase64);
              if (buffer && Buffer.isBuffer(buffer) && buffer.length > 0) {
                const resolvedMimeType =
                  mimeType || mimeTypeFromData || "application/octet-stream";
                const uploadName = fileName || name;
                resource = await createDatasetResourceUpload({
                  fields: {
                    package_id: dataset.id || dataset.name,
                    name: uploadName,
                    description: description || null,
                    format: format || null,
                    mimetype: resolvedMimeType,
                    size: String(buffer.length),
                  },
                  fileBuffer: buffer,
                  fileName: uploadName || "research-output.bin",
                  mimeType: resolvedMimeType,
                });
              }
          }

          if (!resource) {
            resource = await createDatasetResource({
              package_id: dataset.id || dataset.name,
              name,
              description: description || null,
              url,
              format: format || null,
              mimetype: mimeType || null,
              size:
                Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null,
            });
          }
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

  app.post(
    "/api/submissions/:projectId/resources",
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
            error: "You are not allowed to add resources to this project.",
          });
        }

          const outputType = normalizeOutputType(req.body?.output_type);
          const targetCount = Math.max(
            1,
            Number(req.body?.target_count || 1) || 1,
          );
        const notes = asTrimmedString(req.body?.notes);
        const filePath = asTrimmedString(req.body?.file_path);
        const fileName = asTrimmedString(req.body?.file_name);
        const mimeType = asTrimmedString(req.body?.mime_type);
        const fileSize = Number(req.body?.file_size || 0);
        if (!outputType || !ALLOWED_OUTPUT_TYPES.has(outputType)) {
          return badRequest(res, "Expected output type is invalid.");
        }

        const fallbackResourceUrl =
          asTrimmedString(
            getExtraByKey(dataset?.extras, "supporting_mov_link"),
          ) || `${config.ckanBaseUrl}/dataset`;
          const url =
            /^https?:\/\//i.test(filePath) || String(filePath).startsWith("blob:")
              ? filePath
              : `${fallbackResourceUrl}?output_type=${encodeURIComponent(
                  outputType || "resource",
                )}&ts=${Date.now()}`;
          const targetName = formatOutputResourceName(
            { output_type: outputType, target_count: targetCount },
            0,
          );
          const existingResources = Array.isArray(dataset?.resources)
            ? dataset.resources
            : [];
          const placeholderResource = existingResources.find((resource) => {
            if (!resource) return false;
            const name = asTrimmedString(resource?.name);
            const normalized = normalizeOutputType(
              asTrimmedString(resource?.format) || name,
            );
            if (name && name === targetName) return isPlaceholderResourceUrl(resource?.url);
            return (
              normalized === outputType && isPlaceholderResourceUrl(resource?.url)
            );
          });
          if (placeholderResource?.id) {
            await deleteDatasetResource(placeholderResource.id);
          }

          const resource = await createDatasetResource({
            package_id: dataset?.id || projectId,
            name: targetName,
            description: notes || null,
            url,
            format: outputType,
            mimetype: mimeType || null,
            size: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null,
        });

        return res.status(201).json({
          data: {
            resource_id: resource?.id || null,
            dataset_id: dataset?.id || projectId,
            output_type: outputType,
            target_count: targetCount,
            file_name: resource?.name || null,
            file_path: resource?.url || null,
            mime_type: resource?.mimetype || resource?.format || null,
            file_size: resource?.size || null,
            notes: resource?.description || notes || null,
            updated_at:
              resource?.last_modified ||
              dataset?.metadata_modified ||
              new Date().toISOString(),
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to add project resource."),
        });
      }
    },
  );

  app.post(
      "/api/submissions/:projectId/resources/upload",
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
            error: "You are not allowed to add resources to this project.",
          });
        }

          const outputType = normalizeOutputType(req.body?.output_type);
          const targetCount = Math.max(
            1,
            Number(req.body?.target_count || 1) || 1,
          );
        const notes = asTrimmedString(req.body?.notes);
        const fileName =
          asTrimmedString(req.body?.file_name) || "research-output.bin";
        const mimeTypeFromBody = asTrimmedString(req.body?.mime_type);
        const { buffer, mimeType: mimeTypeFromData } = decodeBase64File(
          req.body?.file_base64,
        );

        if (!outputType || !ALLOWED_OUTPUT_TYPES.has(outputType)) {
          return badRequest(res, "Expected output type is invalid.");
        }
        if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
          return badRequest(res, "Output file is required.");
        }
        if (buffer.length > MAX_OUTPUT_UPLOAD_BYTES) {
          return badRequest(res, "Output file must be 25MB or smaller.");
        }

        const mimeType =
          mimeTypeFromBody || mimeTypeFromData || "application/octet-stream";
          const targetName = formatOutputResourceName(
            { output_type: outputType, target_count: targetCount },
            0,
          );
          const existingResources = Array.isArray(dataset?.resources)
            ? dataset.resources
            : [];
          const placeholderResource = existingResources.find((resource) => {
            if (!resource) return false;
            const name = asTrimmedString(resource?.name);
            const normalized = normalizeOutputType(
              asTrimmedString(resource?.format) || name,
            );
            if (name && name === targetName) return isPlaceholderResourceUrl(resource?.url);
            return (
              normalized === outputType && isPlaceholderResourceUrl(resource?.url)
            );
          });
          if (placeholderResource?.id) {
            await deleteDatasetResource(placeholderResource.id);
          }

          const uploadName = fileName || targetName;
          const resource = await createDatasetResourceUpload({
            fields: {
              package_id: dataset?.id || projectId,
              name: uploadName,
              description: notes || null,
              format: outputType,
              mimetype: mimeType,
              size: String(buffer.length),
            },
            fileBuffer: buffer,
            fileName: uploadName || "research-output.bin",
            mimeType,
          });

        return res.status(201).json({
          data: {
            resource_id: resource?.id || null,
            dataset_id: dataset?.id || projectId,
            output_type: outputType,
            target_count: targetCount,
            file_name: resource?.name || null,
            file_path: resource?.url || null,
            mime_type: resource?.mimetype || resource?.format || mimeType,
            file_size: resource?.size || buffer.length,
            notes: resource?.description || notes || null,
            updated_at:
              resource?.last_modified ||
              dataset?.metadata_modified ||
              new Date().toISOString(),
          },
        });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to upload project resource."),
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
