import { apiFetch } from "@/shared/api/httpClient";

const localBlobUrlByPath = new Map();

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

export async function fetchUserProjects({ userId }) {
  void userId;
  try {
    const payload = await apiFetch("/submissions/mine/projects");
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function fetchAllProjects() {
  try {
    const payload = await apiFetch("/submissions/projects");
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function fetchProjectResources({ projectId }) {
  try {
    const payload = await apiFetch(`/submissions/${projectId}/resources`);
    return {
      data: payload?.data || {
        dataset: null,
        resources: [],
        syncEnabled: true,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: { dataset: null, resources: [], syncEnabled: true },
      error,
    };
  }
}

export async function fetchMyResearchOutputs() {
  try {
    const payload = await apiFetch("/submissions/mine/research-outputs");
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function quickEditOwnedProject({ projectId, form }) {
  try {
    const payload = await apiFetch(`/submissions/${projectId}/owner-edit`, {
      method: "PATCH",
      body: JSON.stringify({ form }),
    });
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteOwnedProject({ projectId }) {
  try {
    const payload = await apiFetch(`/submissions/${projectId}`, {
      method: "DELETE",
    });
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function fetchMovSummaryForProjects({ projectIds }) {
  if (!projectIds?.length) {
    return { data: [], error: null };
  }

  try {
    const query = new URLSearchParams({ projectIds: projectIds.join(",") });
    const payload = await apiFetch(
      `/submissions/mov-summary?${query.toString()}`,
    );
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function fetchProjectMovDocuments({ projectId }) {
  try {
    const payload = await apiFetch(`/submissions/${projectId}/mov-documents`);
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function uploadMovFileToStorage({ storagePath, file }) {
  try {
    if (!file) {
      return { data: null, error: new Error("No file selected.") };
    }
    const blobUrl = URL.createObjectURL(file);
    localBlobUrlByPath.set(storagePath, blobUrl);
    return { data: { path: blobUrl }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function createMovPreviewSignedUrl({ filePath }) {
  const raw = String(filePath || "").trim();
  if (!raw) {
    return { data: null, error: new Error("File path is missing.") };
  }

  if (isHttpUrl(raw) || raw.startsWith("blob:")) {
    return { data: { signedUrl: raw }, error: null };
  }

  const localUrl = localBlobUrlByPath.get(raw);
  if (localUrl) {
    return { data: { signedUrl: localUrl }, error: null };
  }

  return {
    data: null,
    error: new Error("Stored file is not accessible in local mode."),
  };
}

export async function fetchProjectTimelineBundle({ projectId }) {
  try {
    const payload = await apiFetch(`/submissions/${projectId}/timeline`);
    return {
      projectRes: { data: payload?.project || null, error: null },
      historyRes: { data: payload?.history || [], error: null },
      reviewRes: { data: payload?.reviews || [], error: null },
    };
  } catch (error) {
    return {
      projectRes: { data: null, error },
      historyRes: { data: [], error },
      reviewRes: { data: [], error },
    };
  }
}

export async function fetchReviewerProfiles({ reviewerIds }) {
  try {
    const query = new URLSearchParams({
      reviewerIds: (reviewerIds || []).join(","),
    });
    const payload = await apiFetch(
      `/submissions/reviewer-profiles?${query.toString()}`,
    );
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

