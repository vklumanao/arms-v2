import { apiFetch } from "@/shared/api/httpClient";

export async function fetchAuditConsoleData() {
  return apiFetch("/admin/audit/console");
}

export async function fetchNotificationMetrics(days = 30) {
  const query = new URLSearchParams({ days: String(days) });
  const payload = await apiFetch(
    `/admin/audit/notification-metrics?${query.toString()}`,
  );
  return payload?.data || null;
}

export async function archiveOldNotifications(days = 90) {
  const payload = await apiFetch("/admin/audit/archive-old-notifications", {
    method: "POST",
    body: JSON.stringify({ days }),
  });
  return payload?.data || 0;
}

