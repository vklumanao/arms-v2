import { query } from "../../db/client.js";

/**
 * Registers public records API routes.
 *
 * System flow:
 * - Loads CKAN datasets and filters public, non-draft records.
 * - Returns lightweight metadata used by the public catalog UI.
 * - Exposes a timeline endpoint (currently empty placeholder).
 */
export function registerPublicRecordsRoutes(app, deps) {
  const {
    listDatasets,
    listOrganizations,
    listGroups,
    listOrganizationAgendas,
    listOrganizationMembers,
    listUsers,
    getUser,
    getDataset,
    asTrimmedString,
    getExtraByKey,
  } = deps;

  async function listLocalUsers() {
    const result = await query(`
        SELECT id, full_name, email, role, department, ckan_user_id, ckan_username
        FROM users
        WHERE is_active = TRUE
      `);
    return Array.isArray(result?.rows) ? result.rows : [];
  }

  function getExtraValue(entity, key) {
    const extras = Array.isArray(entity?.extras) ? entity.extras : [];
    const match = extras.find(
      (item) =>
        String(item?.key || "")
          .trim()
          .toLowerCase() ===
        String(key || "")
          .trim()
          .toLowerCase(),
    );
    return match?.value ?? null;
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
          output_link: asTrimmedString(row?.output_link || row?.outputLink),
          publication_authors: asTrimmedString(
            row?.publication_authors || row?.publicationAuthors,
          ),
        }))
        .filter((row) => row.output_type);
    } catch {
      return [];
    }
  }

  function extractOutputLinkFromDescription(description) {
    const text = asTrimmedString(description);
    if (!text) return "";
    const line = text
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) => entry.toLowerCase().startsWith("output link:"));
    if (!line) return "";
    return line.split("output link:").slice(1).join("output link:").trim();
  }

  function extractAuthorsFromDescription(description) {
    const text = asTrimmedString(description);
    if (!text) return "";
    const line = text
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) =>
        entry.toLowerCase().startsWith("authors/proponents:"),
      );
    if (!line) return "";
    return line
      .split("authors/proponents:")
      .slice(1)
      .join("authors/proponents:")
      .trim();
  }

  function getDatasetTagNames(dataset) {
    const tags = Array.isArray(dataset?.tags) ? dataset.tags : [];
    return tags
      .map((tag) => asTrimmedString(tag?.name || tag?.display_name || tag))
      .filter(Boolean);
  }

  function getSubmissionStateFromExtras(extras) {
    const raw = asTrimmedString(getExtraByKey(extras, "submission_state"));
    return raw ? raw.toLowerCase() : "";
  }

  function mapDatasetToPublicRecord(dataset) {
    const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
    const tagNames = getDatasetTagNames(dataset);
    const yearFromExtra = asTrimmedString(
      getExtraByKey(extras, "project_year") || getExtraByKey(extras, "year"),
    );
    const createdYear = new Date(
      dataset?.metadata_created || dataset?.metadata_modified || 0,
    ).getFullYear();

    return {
      id: dataset?.id || dataset?.name || null,
      ckan_dataset_id: dataset?.id || null,
      title: asTrimmedString(dataset?.title || dataset?.name) || "-",
      abstract: asTrimmedString(dataset?.notes),
      submitted_by_name: asTrimmedString(
        getExtraByKey(extras, "submitted_by_name"),
      ),
      submitted_by_email: asTrimmedString(
        getExtraByKey(extras, "submitted_by_email"),
      ),
      submitted_by_user_id: asTrimmedString(
        getExtraByKey(extras, "submitted_by_user_id"),
      ),
      lead_researcher: asTrimmedString(
        getExtraByKey(extras, "lead_researcher"),
      ),
      lead_researcher_user: getExtraByKey(extras, "lead_researcher_user"),
      faculty_team: asTrimmedString(getExtraByKey(extras, "faculty_team")),
      faculty_team_users: getExtraByKey(extras, "faculty_team_users"),
      student_team: asTrimmedString(getExtraByKey(extras, "student_team")),
      research_agenda_id: asTrimmedString(
        getExtraByKey(extras, "research_agenda_id") ||
          getExtraByKey(extras, "agenda_id"),
      ),
      research_agenda_name: asTrimmedString(
        getExtraByKey(extras, "research_agenda_name") ||
          getExtraByKey(extras, "agenda_name"),
      ),
      scholarly_type: asTrimmedString(getExtraByKey(extras, "scholarly_type")),
      year:
        yearFromExtra ||
        (Number.isFinite(createdYear) && createdYear > 0
          ? String(createdYear)
          : ""),
      status:
        asTrimmedString(
          getExtraByKey(extras, "project_status") ||
            getExtraByKey(extras, "status"),
        ) || "",
      classification:
        asTrimmedString(getExtraByKey(extras, "classification")) ||
        (tagNames.includes("industry") ? "industry" : "academic"),
      research_center_id: asTrimmedString(
        getExtraByKey(extras, "research_center_id") ||
          dataset?.organization?.name ||
          dataset?.owner_org,
      ),
      department_id: asTrimmedString(
        getExtraByKey(extras, "department_id") ||
          getExtraByKey(extras, "program_department") ||
          getExtraByKey(extras, "department"),
      ),
      expected_outputs: asTrimmedString(
        getExtraByKey(extras, "expected_outputs_summary"),
      ),
      industry_partner: asTrimmedString(
        getExtraByKey(extras, "industry_partner"),
      ),
      funding_type: asTrimmedString(getExtraByKey(extras, "funding_type")),
      funding_source: asTrimmedString(getExtraByKey(extras, "funding_source")),
      funding_amount: asTrimmedString(getExtraByKey(extras, "funding_amount")),
      supporting_mov_link: asTrimmedString(
        getExtraByKey(extras, "supporting_mov_link"),
      ),
      signed_moa_reference: asTrimmedString(
        getExtraByKey(extras, "signed_moa_reference"),
      ),
      start_date: asTrimmedString(getExtraByKey(extras, "start_date")),
      end_date: asTrimmedString(getExtraByKey(extras, "end_date")),
      submitted_at:
        asTrimmedString(getExtraByKey(extras, "submitted_at")) ||
        asTrimmedString(dataset?.metadata_created) ||
        null,
      public_visible: !Boolean(dataset?.private),
    };
  }

  async function listAllPublicDatasets() {
    const rows = [];
    const limit = 100;
    let page = 1;

    while (page <= 20) {
      const result = await listDatasets({ page, limit });
      const datasets = Array.isArray(result?.datasets) ? result.datasets : [];
      rows.push(...datasets);

      const total = Number(result?.count || 0);
      if (!datasets.length || rows.length >= total || datasets.length < limit) {
        break;
      }
      page += 1;
    }

    return rows.filter((dataset) => {
      if (Boolean(dataset?.private)) return false;
      const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
      const submissionState = getSubmissionStateFromExtras(extras);
      if (submissionState === "draft") return false;
      return true;
    });
  }

  app.get("/api/public-records", async (_req, res) => {
    try {
      const [datasets, organizations, groups] = await Promise.all([
        listAllPublicDatasets(),
        listOrganizations(),
        listGroups(),
      ]);

      const agendaLabelMap = {};
      const agendaCountByOrg = {};
      await Promise.all(
        (organizations || []).map(async (org) => {
          const orgId = asTrimmedString(org?.name || org?.id);
          if (!orgId) return;
          try {
            const agendas = await listOrganizationAgendas(orgId);
            agendaCountByOrg[orgId] = Array.isArray(agendas)
              ? agendas.length
              : 0;
            (agendas || []).forEach((agenda) => {
              const agendaId = asTrimmedString(agenda?.id);
              if (!agendaId) return;
              agendaLabelMap[agendaId] = asTrimmedString(
                agenda?.name || agenda?.title || agendaId,
              );
            });
          } catch {
            // Ignore agenda lookup errors per org.
            agendaCountByOrg[orgId] = 0;
          }
        }),
      );

      const records = datasets.map((dataset) => {
        const row = mapDatasetToPublicRecord(dataset);
        if (!row.research_agenda_name && row.research_agenda_id) {
          row.research_agenda_name =
            agendaLabelMap[row.research_agenda_id] || row.research_agenda_id;
        }
        return row;
      });
      const centers = (organizations || []).map((org) => {
        const orgId = org?.name || org?.id || "";
        return {
          id: orgId,
          name:
            asTrimmedString(org?.title) ||
            asTrimmedString(org?.display_name) ||
            asTrimmedString(org?.name || org?.id),
          description:
            asTrimmedString(org?.description) ||
            asTrimmedString(getExtraValue(org, "description")) ||
            "",
          code:
            asTrimmedString(getExtraValue(org, "code")) ||
            String(org?.name || org?.id || "")
              .toUpperCase()
              .replace(/[^A-Z0-9_]/g, "_"),
          center_chief_id: asTrimmedString(
            getExtraValue(org, "center_chief_id"),
          ),
          center_chief_name: asTrimmedString(
            getExtraValue(org, "center_chief_name"),
          ),
          agenda_count: Number(agendaCountByOrg[orgId] || 0),
        };
      });
      const departments = (groups || []).map((group) => ({
        id: group?.name || group?.id || "",
        name:
          asTrimmedString(group?.title) ||
          asTrimmedString(group?.display_name) ||
          asTrimmedString(group?.name || group?.id),
      }));

      const timelineExists = records.reduce((acc, record) => {
        if (!record?.id) return acc;
        acc[record.id] = false;
        return acc;
      }, {});

      return res.json({ records, centers, departments, timelineExists });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load public records."),
      });
    }
  });

  app.get("/api/public-records/:projectId/resources", async (req, res) => {
    try {
      const projectId = asTrimmedString(req.params?.projectId);
      if (!projectId) {
        console.log("[public-records] resources missing projectId");
        return res.status(400).json({ error: "Project id is required." });
      }

      const dataset = await getDataset(projectId);
      if (!dataset) {
        console.log("[public-records] resources dataset not found", {
          projectId,
        });
        return res.status(404).json({ error: "Project dataset not found." });
      }

      if (Boolean(dataset?.private)) {
        console.log("[public-records] resources dataset private", {
          projectId,
        });
        return res.status(404).json({ error: "Project dataset not found." });
      }

      const extras = Array.isArray(dataset?.extras) ? dataset.extras : [];
      const submissionState = getSubmissionStateFromExtras(extras);
      if (submissionState === "draft") {
        console.log("[public-records] resources dataset draft", {
          projectId,
        });
        return res.status(404).json({ error: "Project dataset not found." });
      }

      const expectedOutputMetaRows = parseExpectedOutputMetadata(
        getExtraByKey(extras, "expected_outputs_meta"),
      );
      const resources = Array.isArray(dataset?.resources)
        ? dataset.resources
        : [];
      const resourcesWithOutputType = resources.map((resource, index) => {
        const metaRow = expectedOutputMetaRows[index] || null;
        const outputTypeFromMeta = asTrimmedString(metaRow?.output_type);
        const outputLinkFromMeta = asTrimmedString(metaRow?.output_link);
        const outputLinkFromDescription = extractOutputLinkFromDescription(
          resource?.description,
        );
        const publicationAuthorsFromMeta = asTrimmedString(
          metaRow?.publication_authors,
        );
        const publicationAuthorsFromDescription = extractAuthorsFromDescription(
          resource?.description,
        );
        return {
          ...resource,
          output_type: outputTypeFromMeta || null,
          output_link: outputLinkFromMeta || outputLinkFromDescription || null,
          publication_authors:
            publicationAuthorsFromMeta ||
            publicationAuthorsFromDescription ||
            null,
        };
      });

      console.log("[public-records] resources ok", {
        projectId,
        resourceCount: resources.length,
      });
      return res.json({
        data: {
          dataset,
          resources: resourcesWithOutputType,
        },
        syncEnabled: true,
      });
    } catch (error) {
      return res.status(500).json({
        error: String(error?.message || "Failed to load project resources."),
      });
    }
  });

  app.get(
    "/api/public-records/centers/:centerId/affiliates",
    async (req, res) => {
      try {
        const centerId = asTrimmedString(req.params?.centerId);
        if (!centerId) {
          return res.status(400).json({ error: "Center id is required." });
        }
        const [members, users, localUsers] = await Promise.all([
          listOrganizationMembers(centerId),
          listUsers(),
          listLocalUsers(),
        ]);
        const userByEmail = new Map(
          (users || [])
            .filter((row) => row?.email)
            .map((row) => [
              String(row.email || "")
                .trim()
                .toLowerCase(),
              row,
            ]),
        );
        const userById = new Map(
          (users || [])
            .filter((row) => row?.id)
            .map((row) => [asTrimmedString(row.id), row]),
        );
        const localByCkanId = new Map(
          (localUsers || [])
            .filter((row) => row?.ckan_user_id)
            .map((row) => [
              asTrimmedString(row.ckan_user_id),
              row,
            ]),
        );
        const localByEmail = new Map(
          (localUsers || [])
            .filter((row) => row?.email)
            .map((row) => [
              String(row.email || "")
                .trim()
                .toLowerCase(),
              row,
            ]),
        );
        const localByUsername = new Map(
          (localUsers || [])
            .filter((row) => row?.ckan_username)
            .map((row) => [
              String(row.ckan_username || "")
                .trim()
                .toLowerCase(),
              row,
            ]),
        );

        const rows = await Promise.all(
          (members || []).map(async (member) => {
            const memberId = asTrimmedString(member?.id || member?.name);
            const memberEmail = asTrimmedString(member?.email).toLowerCase();
            const memberUsername = asTrimmedString(member?.name).toLowerCase();
            const matchedUser =
              userById.get(memberId) || userByEmail.get(memberEmail) || null;
            const matchedLocalUser =
              localByCkanId.get(memberId) ||
              localByEmail.get(memberEmail) ||
              localByUsername.get(memberUsername) ||
              null;
            let department =
              asTrimmedString(matchedLocalUser?.department) ||
              asTrimmedString(getExtraValue(matchedUser, "department")) ||
              asTrimmedString(getExtraValue(matchedUser, "dept")) ||
              asTrimmedString(getExtraValue(matchedUser, "program_department")) ||
              "";
            let role =
              asTrimmedString(matchedLocalUser?.role) ||
              asTrimmedString(member?.capacity || member?.role);
            let fullName =
              asTrimmedString(matchedLocalUser?.full_name) ||
              asTrimmedString(
                member?.fullname ||
                  member?.display_name ||
                  member?.name ||
                  member?.email,
              );
            let email =
              asTrimmedString(matchedLocalUser?.email) ||
              asTrimmedString(member?.email);

            if ((!department || !role || !fullName) && getUser) {
              const userDetail = await getUser(member?.name || memberId);
              if (userDetail) {
                department =
                  department ||
                  asTrimmedString(getExtraValue(userDetail, "department")) ||
                  asTrimmedString(getExtraValue(userDetail, "dept")) ||
                  asTrimmedString(
                    getExtraValue(userDetail, "program_department"),
                  ) ||
                  "";
                role =
                  role ||
                  asTrimmedString(getExtraValue(userDetail, "role")) ||
                  role;
                fullName =
                  fullName ||
                  asTrimmedString(
                    userDetail?.fullname ||
                      userDetail?.display_name ||
                      userDetail?.name ||
                      userDetail?.email,
                  );
                email = email || asTrimmedString(userDetail?.email);
              }
            }

            return {
              id: memberId,
              name: fullName,
              full_name: fullName,
              email,
              role,
              department,
            };
          }),
        );
        return res.json({ rows });
      } catch (error) {
        return res.status(500).json({
          error: String(error?.message || "Failed to load affiliates."),
        });
      }
    },
  );

  app.get("/api/public-records/:projectId/timeline", async (_req, res) => {
    return res.json({ timeline: [] });
  });
}
