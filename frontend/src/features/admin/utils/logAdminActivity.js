import { apiFetch } from "@/shared/api/httpClient";

export async function logAdminActivity(
  actionType,
  entityType,
  entityId = null,
  metadata = {},
) {
  try {
    await apiFetch("/admin/controls/activity", {
      method: "POST",
      body: JSON.stringify({
        actionType,
        entityType,
        entityId,
        metadata,
      }),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

