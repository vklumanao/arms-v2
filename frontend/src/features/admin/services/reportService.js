import { apiFetch } from "@/shared/api/httpClient";

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

export async function updateProjectVisibility({ projectId, nextVisible }) {
  try {
    const payload = await apiFetch(
      `/admin/reports/project/${projectId}/visibility`,
      {
        method: "PATCH",
        body: JSON.stringify({ nextVisible }),
      },
    );
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function fetchReportDataset() {
  try {
    const payload = await apiFetch("/admin/reports/dataset");
    return {
      projectRes: { data: payload?.projects || [], error: null },
      publicationRes: { data: payload?.publications || [], error: null },
      profileRes: { data: payload?.profiles || [], error: null },
      movRes: { data: payload?.movs || [], error: null },
      centerRes: { data: payload?.centers || [], error: null },
      departmentRes: { data: payload?.departments || [], error: null },
    };
  } catch (error) {
    return {
      projectRes: { data: [], error },
      publicationRes: { data: [], error: null },
      profileRes: { data: [], error: null },
      movRes: { data: [], error: null },
      centerRes: { data: [], error: null },
      departmentRes: { data: [], error: null },
    };
  }
}

export async function fetchProjectDetailBundle({ projectId }) {
  const payload = await apiFetch(`/admin/reports/project/${projectId}/detail`);
  return {
    projectRes: { data: payload?.project || null, error: null },
    historyRes: { data: payload?.history || [], error: null },
    reviewRes: { data: payload?.reviews || [], error: null },
  };
}

export async function fetchProjectMovDocuments({ projectId }) {
  const payload = await apiFetch(
    `/admin/reports/project/${projectId}/mov-documents`,
  );
  return { data: payload?.data || [], error: null };
}

export async function createMovSignedPreviewUrl({ filePath }) {
  const path = String(filePath || "").trim();
  if (!path) {
    return { data: null, error: new Error("MOV file path is missing.") };
  }
  if (isHttpUrl(path) || path.startsWith("blob:")) {
    return { data: { signedUrl: path }, error: null };
  }
  return {
    data: null,
    error: new Error(
      "MOV preview is not available for this legacy file path in local mode.",
    ),
  };
}

