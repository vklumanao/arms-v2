import { apiFetch } from "@/shared/api/httpClient";

const localBlobUrlByPath = new Map();
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4010/api";

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

export function buildProjectPayload(form, userId) {
  return {
    submitted_by: userId,
    title: form.title.trim(),
    lead_researcher: form.lead_researcher || null,
    lead_researcher_user: form.lead_researcher_user || null,
    faculty_team: form.faculty_team || null,
    faculty_team_users: Array.isArray(form.faculty_team_users)
      ? form.faculty_team_users
      : [],
    student_team: form.student_team || null,
    abstract: form.abstract || null,
    year: Number(form.year),
    research_center_id: form.research_center_id,
    research_agenda_id: form.research_agenda_id || null,
    department_id: form.department_id || null,
    scholarly_type: form.scholarly_type || null,
    funding_type: form.funding_type,
    funding_category: form.funding_category || null,
    industry_partner: form.industry_partner || null,
    funding_source: form.funding_source || null,
    funding_amount: Number(form.funding_amount || 0),
    classification: form.classification,
    status: form.status || "ongoing",
    expected_outputs: form.expected_outputs || null,
    supporting_mov_link: form.supporting_mov_link || null,
    signed_moa_reference: form.signed_moa_reference || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    public_visible: Boolean(form.public_visible),
  };
}

export async function fetchEditableSubmission({ projectId }) {
  try {
    const payload = await apiFetch(`/submissions/${projectId}/editable`);
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

function serializeExpectedOutputs(rows = []) {
  return (rows || []).map((row) => ({
    output_type: row.output_type || "",
    target_count: Math.max(1, Number(row.target_count) || 1),
    notes: row.notes || "",
    file_path: row.file_path || "",
    file_name: row.file_name || row.file?.name || "",
    file_size: Number(row.file_size || row.file?.size || 0) || null,
    mime_type: row.mime_type || row.file?.type || "",
  }));
}

export async function saveSubmission({ userId, editId, form, expectedOutputs }) {
  const payload = buildProjectPayload(form, userId);

  try {
    const result = await apiFetch("/submissions/publish", {
      method: "POST",
      body: JSON.stringify({
        form: payload,
        dataset_id: editId || null,
        expected_outputs: serializeExpectedOutputs(expectedOutputs),
      }),
    });

    return {
      mode: editId ? "revise" : "create",
      data: result?.data || null,
      error: null,
    };
  } catch (error) {
    return { mode: editId ? "revise" : "create", data: null, error };
  }
}

export async function fetchProjectExpectedOutputs({ projectId }) {
  try {
    const payload = await apiFetch(
      `/submissions/${projectId}/expected-outputs`,
    );
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function insertProjectExpectedOutput({
  projectId,
  outputType,
  targetCount,
  notes,
}) {
  try {
    const payload = await apiFetch(
      `/submissions/${projectId}/expected-outputs`,
      {
        method: "POST",
        body: JSON.stringify({ outputType, targetCount, notes }),
      },
    );
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateProjectExpectedOutput({
  outputId,
  outputType,
  targetCount,
  notes,
}) {
  try {
    const payload = await apiFetch(
      `/submissions/expected-outputs/${outputId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ outputType, targetCount, notes }),
      },
    );
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateProjectExpectedOutputFile({
  outputId,
  filePath,
  fileName,
  mimeType,
  fileSize,
}) {
  try {
    const payload = await apiFetch(
      `/submissions/expected-outputs/${outputId}/file`,
      {
        method: "PATCH",
        body: JSON.stringify({
          filePath,
          fileName,
          mimeType,
          fileSize,
        }),
      },
    );
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteProjectExpectedOutputs({ outputIds }) {
  if (!outputIds?.length) {
    return { error: null };
  }

  try {
    await apiFetch("/submissions/expected-outputs", {
      method: "DELETE",
      body: JSON.stringify({ outputIds }),
    });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function uploadExpectedOutputFileToStorage({ storagePath, file }) {
  try {
    if (!file) {
      return { data: null, error: new Error("No file selected.") };
    }
    const outputId = String(storagePath || "")
      .split("/")
      .filter(Boolean)
      .slice(-2, -1)[0];
    if (!outputId) {
      return {
        data: null,
        error: new Error("Expected output id is missing for upload."),
      };
    }

    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `${API_BASE_URL}/submissions/expected-outputs/${outputId}/upload`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      },
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        data: null,
        error: new Error(
          payload?.error || `Upload failed with status ${response.status}`,
        ),
      };
    }

    return { data: { path: payload?.data?.filePath || null }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function removeExpectedOutputFilesFromStorage({ filePaths }) {
  (filePaths || []).forEach((path) => {
    const url = localBlobUrlByPath.get(path);
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
    localBlobUrlByPath.delete(path);
  });
  return { data: null, error: null };
}

export async function copyExpectedOutputFileInStorage({ fromPath, toPath }) {
  const source = localBlobUrlByPath.get(fromPath) || fromPath;
  if (!source) {
    return { data: null, error: new Error("Source file is missing.") };
  }
  if (!isHttpUrl(source) && !String(source).startsWith("blob:")) {
    return {
      data: null,
      error: new Error("Stored file is not accessible in local mode."),
    };
  }
  localBlobUrlByPath.set(toPath, source);
  return { data: { path: toPath }, error: null };
}
