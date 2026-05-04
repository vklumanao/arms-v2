import { apiFetch } from "@/services/httpClient";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

export function isAllowedMovMimeType(type) {
  return ALLOWED_MIME_TYPES.has(type);
}

export async function registerMovUpload({
  projectId,
  userId,
  fileName,
  filePath,
  mimeType,
  fileSize,
}) {
  void userId;
  try {
    const payload = await apiFetch("/submissions/mov/register", {
      method: "POST",
      body: JSON.stringify({
        projectId,
        fileName,
        filePath,
        mimeType,
        fileSize,
      }),
    });
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

