const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4010/api";
const UI_PREVIEW_MODE =
  String(import.meta.env.VITE_UI_PREVIEW_MODE || "false").toLowerCase() ===
  "true";

function mockAuthPayload() {
  return {
    token: null,
    user: {
      id: "demo-user-1",
      email: "demo@arms.local",
      role: "admin",
      isAuthenticated: true,
    },
    profile: {
      id: "demo-profile-1",
      full_name: "Demo Admin",
      role: "admin",
      is_active: true,
      is_center_chief: false,
      managed_center_id: null,
      managed_center_name: null,
    },
  };
}

function mockApiPayload(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const cleanPath = String(path || "").split("?")[0];

  if (cleanPath === "/auth/me") return mockAuthPayload();
  if (cleanPath === "/auth/login") return mockAuthPayload();
  if (cleanPath === "/auth/register") return mockAuthPayload();
  if (cleanPath === "/auth/forgot-password") return { ok: true };
  if (cleanPath === "/auth/reset-password") return { ok: true };
  if (cleanPath === "/auth/change-password") return { ok: true, warning: null };
  if (cleanPath === "/auth/logout") return { ok: true };

  if (cleanPath === "/permissions/role-map") {
    return {
      map: {
        student: [
          "dashboard.view",
          "affiliate_profile.view",
          "affiliations.manage",
          "research_outputs.view",
          "awards_recognition.view",
        ],
        faculty: [
          "dashboard.view",
          "affiliate_profile.view",
          "affiliations.manage",
          "research_outputs.view",
          "awards_recognition.view",
        ],
        admin: [
          "dashboard.view",
          "affiliate_profile.view",
          "affiliations.manage",
          "research_outputs.view",
          "awards_recognition.view",
          "admin.controls.manage",
          "admin.users.manage",
          "admin.affiliates.manage",
        ],
      },
    };
  }
  if (cleanPath === "/permissions/role-map/reset") return { ok: true };

  if (cleanPath === "/reference-data") {
    return {
      centers: [{ id: "center-1", name: "Research Center A" }],
      agendas: [{ id: "agenda-1", name: "Innovation Agenda" }],
      departments: [{ id: "dept-1", name: "Computer Science" }],
      proponents: [],
    };
  }

  if (cleanPath === "/integrations/ckan/organizations") {
    return {
      data: [{ id: "org-1", name: "org-1", title: "Research Center A" }],
    };
  }
  if (cleanPath === "/integrations/ckan/groups") {
    return {
      data: [{ id: "group-1", name: "group-1", title: "Computer Science" }],
    };
  }
  if (cleanPath === "/integrations/ckan/users") {
    return {
      data: [
        {
          id: "ckan-user-1",
          name: "Demo Admin",
          username: "demo-admin",
          email: "demo@arms.local",
          state: "active",
          role: "admin",
        },
        {
          id: "ckan-user-2",
          name: "Demo Faculty",
          username: "demo-faculty",
          email: "faculty@arms.local",
          state: "active",
          role: "faculty",
        },
        {
          id: "ckan-user-3",
          name: "Demo Student",
          username: "demo-student",
          email: "student@arms.local",
          state: "active",
          role: "student",
        },
      ],
    };
  }
  if (cleanPath.includes("/integrations/ckan/organizations/")) {
    return { data: [] };
  }

  if (cleanPath === "/dashboard/projects") return { data: [] };
  if (cleanPath === "/dashboard/status-history") return { data: [] };
  if (cleanPath === "/dashboard/notify-upcoming-deadlines") return { data: 0 };

  if (cleanPath === "/public-records") {
    return { records: [], centers: [], departments: [], timelineExists: {} };
  }
  if (cleanPath.includes("/public-records/")) return { timeline: [] };

  if (cleanPath === "/admin/users" && method === "POST") {
    const rawBody =
      typeof options.body === "string"
        ? JSON.parse(options.body || "{}")
        : options.body || {};
    const first = String(rawBody.first_name || "").trim();
    const last = String(rawBody.last_name || "").trim();
    const middleRaw = String(rawBody.middle_initial || "")
      .replace(/\./g, "")
      .trim();
    const middle = middleRaw ? middleRaw.charAt(0).toUpperCase() : "";
    const formatted =
      last && first
        ? `${last.toUpperCase()}, ${first.toUpperCase()}${middle ? ` ${middle}.` : ""}`
        : rawBody.full_name || "Created User";
    return {
      data: {
        id: "demo-user-created",
        full_name: formatted,
        email: rawBody.email || "created@arms.local",
        role: rawBody.role || "faculty",
        department: rawBody.department || null,
        ckan_org_id: rawBody.ckan_org_id || null,
        ckan_group_id: rawBody.ckan_group_id || null,
        ckan_username: "created-user",
        ckan_user_id: "ckan-created-user",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_sign_in_at: null,
        email_confirmed_at: null,
        temporary_password: "Arms!demo1234",
      },
    };
  }
  if (cleanPath === "/admin/users") return { data: [] };
  if (cleanPath.includes("/admin/users/") && cleanPath.endsWith("/detail")) {
    return {
      data: {
        profile: null,
        researchProjects: [],
        reviews: [],
      },
    };
  }
  if (cleanPath.includes("/admin/users/")) return { data: null };

  if (cleanPath === "/admin/controls/reference-data") {
    return {
      centers: [
        {
          id: "org-1",
          name: "Research Center A",
          code: "ORG_1",
          center_chief_id: "ckan-user-2",
          center_chief_name: "Demo Faculty",
        },
      ],
      agendas: [],
      departments: [],
      proponents: [
        {
          id: "demo-proponent-1",
          name: "Demo Faculty",
          full_name: "Demo Faculty",
          email: "faculty@arms.local",
          role: "faculty",
          department: "Computer Science",
          ckan_org_id: "org-1",
          ckan_group_id: "group-1",
          ckan_username: "demo-faculty",
          ckan_user_id: "ckan-user-2",
          is_active: true,
        },
      ],
      ckan_users: [
        {
          id: "ckan-user-2",
          name: "Demo Faculty",
          username: "demo-faculty",
          email: "faculty@arms.local",
          state: "active",
          role: "faculty",
        },
      ],
    };
  }
  if (cleanPath === "/admin/controls/reference-usage") {
    return {
      projectCount: 0,
      profileCount: 0,
      memberBreakdown: { adminCount: 0, editorCount: 0, memberCount: 0 },
    };
  }
  if (cleanPath === "/admin/controls/reference-links") {
    return { profiles: [], projects: [], agendas: [] };
  }
  if (cleanPath === "/admin/controls/reassign-dependencies") {
    return { data: { updated: 0 } };
  }
  if (cleanPath === "/admin/controls/sync-ckan-orgs") {
    return { summary: { synced: 0 } };
  }
  if (cleanPath === "/admin/controls/proponents/accounts" && method === "POST") {
    const rawBody =
      typeof options.body === "string"
        ? JSON.parse(options.body || "{}")
        : options.body || {};
    const first = String(rawBody.first_name || "").trim();
    const last = String(rawBody.last_name || "").trim();
    const middleRaw = String(rawBody.middle_initial || "")
      .replace(/\./g, "")
      .trim();
    const middle = middleRaw ? middleRaw.charAt(0).toUpperCase() : "";
    const formatted =
      last && first
        ? `${last.toUpperCase()}, ${first.toUpperCase()}${middle ? ` ${middle}.` : ""}`
        : rawBody.full_name || "Created Proponent";
    return {
      data: {
        id: "demo-proponent-created",
        name: formatted,
        full_name: formatted,
        email: rawBody.email || "created@arms.local",
        role: rawBody.role || "faculty",
        department: rawBody.department || null,
        ckan_org_id: rawBody.ckan_org_id || null,
        ckan_group_id: rawBody.ckan_group_id || null,
        ckan_username: "created-proponent",
        ckan_user_id: "ckan-created-user",
        is_active: true,
        temporary_password: "Arms!demo1234",
      },
    };
  }
  if (cleanPath.includes("/admin/controls/reference/")) {
    if (method === "PATCH") return { data: null };
    return { ok: true };
  }

  if (cleanPath === "/admin/affiliates") return { data: [] };
  if (cleanPath.includes("/admin/affiliates/")) {
    const rawBody =
      typeof options.body === "string"
        ? JSON.parse(options.body || "{}")
        : options.body || {};
    const first = String(rawBody.first_name || "").trim();
    const last = String(rawBody.last_name || "").trim();
    const middleRaw = String(rawBody.middle_initial || "")
      .replace(/\./g, "")
      .trim();
    const middle = middleRaw ? middleRaw.charAt(0).toUpperCase() : "";
    const formatted =
      last && first
        ? `${last.toUpperCase()}, ${first.toUpperCase()}${middle ? ` ${middle}.` : ""}`
        : rawBody.full_name || "Updated Affiliate";
    return {
      data: {
        id: cleanPath.split("/").pop() || "demo-affiliate-id",
        full_name: formatted,
        email: rawBody.email || "affiliate@arms.local",
        role: rawBody.role || "faculty",
        department: rawBody.department || null,
        ckan_org_id: rawBody.ckan_org_id || null,
        ckan_group_id: rawBody.ckan_group_id || null,
        ckan_username: "affiliate-user",
        ckan_user_id: "ckan-affiliate-user",
        is_active: true,
        google_scholar_link: rawBody.google_scholar_link || null,
        employment_status: rawBody.employment_status || null,
        designation: rawBody.designation || null,
        is_gs_faculty: Boolean(rawBody.is_gs_faculty),
        publication_count: Number(rawBody.publication_count || 0),
        research_project_count: Number(rawBody.research_project_count || 0),
        creative_work_count: Number(rawBody.creative_work_count || 0),
        awards_count: Number(rawBody.awards_count || 0),
        ip_count: Number(rawBody.ip_count || 0),
        updated_at: new Date().toISOString(),
      },
    };
  }

  if (cleanPath === "/affiliate-profile/me") return { data: null };
  if (cleanPath === "/awards" && method === "GET") {
    return {
      data: [
        {
          id: "mock-award-1",
          ckan_dataset_id: "mock-award-1",
          work_title: "AI-Assisted Crop Monitoring",
          award_recognition: "Best Innovation Paper",
          awarding_body: "National Research Congress",
          year_received: "2026",
          level: "National",
          recipients: "Demo Admin, Demo Faculty",
          recipient_users: [
            {
              id: "ckan-user-1",
              name: "Demo Admin",
              username: "demo-admin",
              email: "demo@arms.local",
            },
            {
              id: "ckan-user-2",
              name: "Demo Faculty",
              username: "demo-faculty",
              email: "faculty@arms.local",
            },
          ],
          supporting_movs: "https://example.com/award-mov",
          supporting_mov_resource_id: "mock-award-resource-id",
          supporting_mov_file_name: "Supporting MOV - award-proof.pdf",
          supporting_mov_file_path: "https://example.com/award-proof.pdf",
          supporting_mov_file_mime_type: "application/pdf",
          supporting_mov_file_size: 204800,
          notes: "Mock award record for preview mode.",
          research_center_id: "org-1",
          research_center_name: "Research Center A",
          department_id: "dept-1",
          program_department: "Computer Science",
          submitted_by_user_id: "demo-user-1",
          submitted_by_email: "demo@arms.local",
          submitted_by_name: "Demo Admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          private: true,
        },
      ],
    };
  }
  if (cleanPath === "/awards/recipient-options" && method === "GET") {
    return {
      data: [
        {
          id: "ckan-user-2",
          name: "Demo Faculty",
          username: "demo-faculty",
          email: "faculty@arms.local",
          role: "faculty",
          state: "active",
        },
        {
          id: "ckan-user-3",
          name: "Demo Student",
          username: "demo-student",
          email: "student@arms.local",
          role: "student",
          state: "active",
        },
      ],
    };
  }
  if (cleanPath === "/awards" && method === "POST") {
    let parsed = {};
    try {
      parsed = JSON.parse(String(options.body || "{}"));
    } catch {
      parsed = {};
    }
    return {
      data: {
        id: "mock-award-created",
        ckan_dataset_id: "mock-award-created",
        ...parsed,
        research_center_name: "Research Center A",
        program_department: parsed?.program_department || "Computer Science",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        private: true,
      },
    };
  }
  if (cleanPath.startsWith("/awards/") && method === "PATCH") {
    let parsed = {};
    try {
      parsed = JSON.parse(String(options.body || "{}"));
    } catch {
      parsed = {};
    }
    return {
      data: {
        id: cleanPath.split("/")[2] || "mock-award-id",
        ckan_dataset_id: cleanPath.split("/")[2] || "mock-award-id",
        ...parsed,
        research_center_name: "Research Center A",
        updated_at: new Date().toISOString(),
        private: true,
      },
    };
  }
  if (cleanPath.startsWith("/awards/") && cleanPath.endsWith("/mov-upload")) {
    return {
      data: {
        resource_id: "mock-award-resource-id",
        dataset_id: cleanPath.split("/")[2] || "mock-award-id",
        file_name: "Supporting MOV - award-proof.pdf",
        file_path: "https://example.com/award-proof.pdf",
        mime_type: "application/pdf",
        file_size: 204800,
        updated_at: new Date().toISOString(),
      },
    };
  }
  if (cleanPath.startsWith("/awards/") && method === "DELETE") {
    return {
      data: {
        id: cleanPath.split("/")[2] || "mock-award-id",
        deleted: true,
      },
    };
  }
  if (cleanPath.startsWith("/awards/") && method === "GET") {
    return {
      data: {
        id: cleanPath.split("/")[2] || "mock-award-id",
        ckan_dataset_id: cleanPath.split("/")[2] || "mock-award-id",
        work_title: "AI-Assisted Crop Monitoring",
        award_recognition: "Best Innovation Paper",
        awarding_body: "National Research Congress",
        year_received: "2026",
        level: "National",
        recipients: "Demo Admin, Demo Faculty",
        recipient_users: [
          {
            id: "ckan-user-1",
            name: "Demo Admin",
            username: "demo-admin",
            email: "demo@arms.local",
          },
          {
            id: "ckan-user-2",
            name: "Demo Faculty",
            username: "demo-faculty",
            email: "faculty@arms.local",
          },
        ],
        supporting_movs: "https://example.com/award-mov",
        supporting_mov_resource_id: "mock-award-resource-id",
        supporting_mov_file_name: "Supporting MOV - award-proof.pdf",
        supporting_mov_file_path: "https://example.com/award-proof.pdf",
        supporting_mov_file_mime_type: "application/pdf",
        supporting_mov_file_size: 204800,
        notes: "Mock award record for preview mode.",
        research_center_id: "org-1",
        research_center_name: "Research Center A",
        department_id: "dept-1",
        program_department: "Computer Science",
        private: true,
      },
    };
  }
  if (cleanPath === "/submissions/mine/projects") {
    return {
      data: [
        {
          id: "mock-project-owned-1",
          ckan_dataset_id: "mock-project-owned-1",
          title: "Owned Research Project",
          lead_researcher: "Demo Faculty",
          faculty_team: "Demo Faculty",
          faculty_team_users: [
            {
              id: "ckan-user-2",
              name: "Demo Faculty",
              username: "demo-faculty",
              email: "faculty@arms.local",
              role: "faculty",
            },
          ],
          submitted_by_name: "Demo Faculty",
          submitted_by_email: "faculty@arms.local",
          submitted_at: new Date().toISOString(),
          year: "2026",
          status: "ongoing",
          expected_outputs: "Publication (Target: 1)",
          private: true,
          organization: { name: "org-1", title: "Research Center A" },
          resources: [],
        },
      ],
    };
  }
  if (cleanPath === "/submissions/mine/linked-projects") {
    return {
      data: [
        {
          id: "mock-project-linked-1",
          ckan_dataset_id: "mock-project-linked-1",
          title: "Linked Collaborative Project",
          lead_researcher: "Another Faculty",
          faculty_team: "Demo Faculty; Another Faculty",
          faculty_team_users: [
            {
              id: "ckan-user-2",
              name: "Demo Faculty",
              username: "demo-faculty",
              email: "faculty@arms.local",
              role: "faculty",
            },
          ],
          submitted_by_name: "Another Faculty",
          submitted_by_email: "another@arms.local",
          submitted_at: new Date().toISOString(),
          year: "2026",
          status: "proposal",
          expected_outputs: "Patent / Intellectual Property (Target: 1)",
          private: true,
          organization: { name: "org-1", title: "Research Center A" },
          resources: [],
        },
      ],
    };
  }
  if (cleanPath === "/submissions/projects") return { data: [] };
  if (cleanPath === "/submissions/mine/research-outputs") return { data: [] };
  if (cleanPath === "/submissions/mov-summary") return { data: [] };
  if (cleanPath === "/submissions/reviewer-profiles") return { data: [] };

  if (cleanPath.includes("/submissions/") && cleanPath.endsWith("/resources")) {
    return { data: { dataset: null, resources: [], syncEnabled: true } };
  }
  if (
    cleanPath.includes("/submissions/") &&
    cleanPath.endsWith("/mov-documents")
  ) {
    return { data: [] };
  }
  if (cleanPath.includes("/submissions/") && cleanPath.endsWith("/timeline")) {
    return { project: null, history: [], reviews: [] };
  }
  if (cleanPath.includes("/submissions/") && cleanPath.endsWith("/editable")) {
    return {
      data: {
        id: cleanPath.split("/")[2] || "mock-project-id",
        title: "Mock Research Project",
        lead_researcher: "Demo Lead",
        lead_researcher_user: {
          id: "ckan-user-2",
          name: "Demo Faculty",
          username: "demo-faculty",
          email: "faculty@arms.local",
          role: "faculty",
        },
        faculty_team: "Demo Faculty 1; Demo Faculty 2",
        faculty_team_users: [
          {
            id: "ckan-user-2",
            name: "Demo Faculty",
            username: "demo-faculty",
            email: "faculty@arms.local",
            role: "faculty",
          },
          {
            id: "ckan-user-4",
            name: "Demo Faculty 2",
            username: "demo-faculty-2",
            email: "faculty2@arms.local",
            role: "faculty",
          },
        ],
        student_team: "Demo Student 1",
        abstract: "Mock abstract",
        year: "2026",
        research_center_id: "org-1",
        research_agenda_id: "agenda-1",
        department_id: "dept-1",
        scholarly_type: "applied",
        funding_type: "internal",
        funding_category: "grant",
        industry_partner: "Demo Industry",
        funding_source: "Demo Fund",
        funding_amount: "100000",
        classification: "academic",
        status: "ongoing",
        expected_outputs: "Publication (Target: 1)",
        supporting_mov_link: "https://example.com/mov",
        signed_moa_reference: "MOA-2026-0001",
        start_date: "2026-01-10",
        end_date: "2026-12-10",
        public_visible: false,
      },
    };
  }
  if (
    cleanPath.includes("/submissions/") &&
    cleanPath.endsWith("/expected-outputs")
  ) {
    return {
      data: [
        {
          id: "mock-output-1",
          output_type: "publication",
          target_count: 1,
          notes: "Mock output note",
          file_path: "https://example.com/resource.pdf",
          file_name: "publication (Target: 1)",
          mime_type: "application/pdf",
          file_size: 102400,
        },
      ],
    };
  }
  if (cleanPath.includes("/submissions/expected-outputs/")) {
    return { data: null };
  }
  if (
    cleanPath.includes("/submissions/") &&
    cleanPath.endsWith("/owner-edit")
  ) {
    let parsed = {};
    try {
      parsed = JSON.parse(String(options.body || "{}"));
    } catch {
      parsed = {};
    }
    const form = parsed?.form || {};
    return {
      data: {
        id: cleanPath.split("/")[2] || "mock-project-id",
        ckan_dataset_id: cleanPath.split("/")[2] || "mock-project-id",
        title: String(form?.title || "Updated Project"),
        abstract: String(form?.abstract || ""),
        year: String(form?.year || "-"),
        industry_partner: String(form?.industry_partner || ""),
        funding_source: String(form?.funding_source || ""),
        funding_amount: String(form?.funding_amount || "0"),
        start_date: String(form?.start_date || ""),
        end_date: String(form?.end_date || ""),
        updated_at: new Date().toISOString(),
      },
    };
  }
  if (
    cleanPath.includes("/submissions/datasets/") &&
    cleanPath.endsWith("/visibility") &&
    method === "PATCH"
  ) {
    let isPublic = false;
    try {
      const parsed = JSON.parse(String(options.body || "{}"));
      isPublic = parsed?.isPublic === true;
    } catch {
      isPublic = false;
    }
    return {
      data: {
        dataset_id: "mock-dataset-id",
        project_public_visible: isPublic,
      },
    };
  }
  if (cleanPath.includes("/submissions/resources/") && method === "PATCH") {
    let parsed = {};
    try {
      parsed = JSON.parse(String(options.body || "{}"));
    } catch {
      parsed = {};
    }
    return {
      data: {
        resource_id: cleanPath.split("/").pop() || "mock-resource-id",
        dataset_id: "mock-dataset-id",
        file_name: parsed?.file_name || "Updated Resource File",
        notes: parsed?.notes || null,
        file_path: parsed?.file_path || "https://example.com/resource",
        mime_type: parsed?.mime_type || "application/pdf",
        file_size: Number(parsed?.file_size || 0) || null,
        updated_at: new Date().toISOString(),
      },
    };
  }
  if (cleanPath.includes("/submissions/resources/") && method === "DELETE") {
    return {
      data: {
        resource_id: cleanPath.split("/").pop() || "mock-resource-id",
        dataset_id: "mock-dataset-id",
        deleted: true,
      },
    };
  }
  if (
    cleanPath.includes("/submissions/") &&
    cleanPath.endsWith("/resources/upload") &&
    method === "POST"
  ) {
    return {
      data: {
        resource_id: "mock-resource-id",
        dataset_id: cleanPath.split("/")[2] || "mock-project-id",
        output_type: "publication",
        target_count: 1,
        file_name: "uploaded-file.pdf",
        file_path: "https://example.com/resource/uploaded-file.pdf",
        mime_type: "application/pdf",
        file_size: 102400,
        notes: null,
        updated_at: new Date().toISOString(),
      },
    };
  }
  if (cleanPath.startsWith("/submissions/") && method === "DELETE") {
    return {
      data: {
        id: cleanPath.split("/")[2] || "mock-project-id",
        deleted: true,
      },
    };
  }
  if (cleanPath === "/submissions" || cleanPath.startsWith("/submissions/")) {
    return { data: null };
  }

  return { data: [], ok: true };
}

export async function apiFetch(path, options = {}) {
  if (UI_PREVIEW_MODE) {
    return mockApiPayload(path, options);
  }

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(
      payload?.error || `Request failed with status ${response.status}`,
    );
  }

  return payload;
}
