import { apiFetch } from "@/services/httpClient";

export async function listAwardRecognitionRecords(options = {}) {
  try {
    const query = new URLSearchParams();
    if (options?.q) query.set("q", String(options.q).trim());
    if (options?.projectId)
      query.set("project_id", String(options.projectId).trim());
    const payload = await apiFetch(`/awards${query.toString() ? `?${query}` : ""}`);
    return { data: Array.isArray(payload?.data) ? payload.data : [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function listCenterChiefAwardRecognitionRecords(options = {}) {
  try {
    const query = new URLSearchParams();
    if (options?.q) query.set("q", String(options.q).trim());
    const payload = await apiFetch(
      `/awards/center-chief${query.toString() ? `?${query}` : ""}`,
    );
    return { data: Array.isArray(payload?.data) ? payload.data : [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function createAwardRecognitionRecord(input) {
  try {
    const payload = await apiFetch("/awards", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function fetchAwardRecognitionRecord(recordId) {
  try {
    const payload = await apiFetch(`/awards/${encodeURIComponent(recordId)}`);
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateAwardRecognitionRecord(recordId, input) {
  try {
    const payload = await apiFetch(`/awards/${encodeURIComponent(recordId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteAwardRecognitionRecord(recordId) {
  try {
    const payload = await apiFetch(`/awards/${encodeURIComponent(recordId)}`, {
      method: "DELETE",
    });
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function uploadAwardRecognitionMovFile({ recordId, file }) {
  try {
    if (!file) {
      throw new Error("No MOV file selected.");
    }

    const arrayBuffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binary);

    const payload = await apiFetch(
      `/awards/${encodeURIComponent(recordId)}/mov-upload`,
      {
        method: "POST",
        body: JSON.stringify({
          file_name: file.name || "award-supporting-mov.bin",
          mime_type: file.type || "application/octet-stream",
          file_base64: base64,
        }),
      },
    );
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function listAwardRecipientOptions(options = {}) {
  try {
    const query = new URLSearchParams();
    if (options?.orgId) query.set("org_id", String(options.orgId).trim());
    const payload = await apiFetch(
      `/awards/recipient-options${query.toString() ? `?${query}` : ""}`,
    );
    return {
      data: Array.isArray(payload?.data) ? payload.data : [],
      error: null,
    };
  } catch (error) {
    return { data: [], error };
  }
}
