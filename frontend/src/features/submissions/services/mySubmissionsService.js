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

export async function fetchLinkedProjects() {
  try {
    const payload = await apiFetch("/submissions/mine/linked-projects");
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

export async function updateResearchOutputVisibility({ datasetId, isPublic }) {
  try {
    const payload = await apiFetch(
      `/submissions/datasets/${encodeURIComponent(String(datasetId || "").trim())}/visibility`,
      {
        method: "PATCH",
        body: JSON.stringify({ isPublic: Boolean(isPublic) }),
      },
    );
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateResearchOutput({ resourceId, payload }) {
  try {
    const id = encodeURIComponent(String(resourceId || "").trim());
    const body = payload && typeof payload === "object" ? payload : {};
    const response = await apiFetch(`/submissions/resources/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return { data: response?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteResearchOutput({ resourceId }) {
  try {
    const id = encodeURIComponent(String(resourceId || "").trim());
    const response = await apiFetch(`/submissions/resources/${id}`, {
      method: "DELETE",
    });
    return { data: response?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function createResearchOutput({
  projectId,
  outputType,
  targetCount,
  notes,
  filePath,
  fileName,
  mimeType,
  fileSize,
}) {
  try {
    const id = encodeURIComponent(String(projectId || "").trim());
    const payload = await apiFetch(`/submissions/${id}/resources`, {
      method: "POST",
      body: JSON.stringify({
        output_type: outputType,
        target_count: targetCount,
        notes,
        file_path: filePath,
        file_name: fileName,
        mime_type: mimeType,
        file_size: fileSize,
      }),
    });
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function createResearchOutputWithFile({
  projectId,
  outputType,
  targetCount,
  notes,
  file,
}) {
  try {
    const id = encodeURIComponent(String(projectId || "").trim());
    if (!file) {
      throw new Error("No output file selected.");
    }

    const arrayBuffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);

    const payload = await apiFetch(`/submissions/${id}/resources/upload`, {
      method: "POST",
      body: JSON.stringify({
        output_type: outputType,
        target_count: targetCount,
        notes,
        file_name: file.name || "research-output.bin",
        mime_type: file.type || "application/octet-stream",
        file_base64: base64,
      }),
    });
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
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

