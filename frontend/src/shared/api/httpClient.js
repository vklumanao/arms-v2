const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4010/api";
const UI_PREVIEW_MODE =
  String(import.meta.env.VITE_UI_PREVIEW_MODE || "false").toLowerCase() ===
  "true";

const TOKEN_KEY = "arms_auth_token";

export function getAuthToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAuthToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

function mockAuthPayload() {
  return {
    token: "ui-preview-token",
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
    },
  };
}

function mockApiPayload(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const cleanPath = String(path || "").split("?")[0];

  if (cleanPath === "/auth/me") return mockAuthPayload();
  if (cleanPath === "/auth/login") return mockAuthPayload();
  if (cleanPath === "/auth/register") return { ok: true };
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
      centers: [],
      agendas: [],
      departments: [],
      proponents: [],
      ckan_users: [],
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
  if (cleanPath.includes("/admin/controls/reference/")) {
    if (method === "PATCH") return { data: null };
    return { ok: true };
  }

  if (cleanPath === "/admin/affiliates") return { data: [] };
  if (cleanPath.includes("/admin/affiliates/")) return { data: null };

  if (cleanPath === "/affiliate-profile/me") return { data: null };
  if (cleanPath === "/submissions/mine/projects") return { data: [] };
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
        faculty_team: "Demo Faculty 1; Demo Faculty 2",
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
  if (cleanPath.includes("/submissions/expected-outputs/"))
    return { data: null };
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

  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

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

