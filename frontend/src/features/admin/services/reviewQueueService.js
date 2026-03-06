import { apiFetch } from "@/shared/api/httpClient";

export async function fetchReviewQueueSnapshot() {
  return apiFetch("/admin/review/queue-snapshot");
}

export async function fetchReviewedTodayCount(userId) {
  if (!userId) return 0;
  const query = new URLSearchParams({ userId });
  const payload = await apiFetch(
    `/admin/review/reviewed-today?${query.toString()}`,
  );
  return payload?.count || 0;
}

export async function fetchProjectDetailBundle(projectId) {
  return apiFetch(`/admin/review/project/${projectId}/detail`);
}

export async function assignReviewerToProject({ projectId, reviewerId }) {
  return apiFetch("/admin/review/assign-reviewer", {
    method: "POST",
    body: JSON.stringify({ projectId, reviewerId }),
  });
}

export async function markProjectCompleted({ projectId }) {
  return apiFetch("/admin/review/mark-completed", {
    method: "POST",
    body: JSON.stringify({ projectId }),
  });
}

export async function updateReviewQueueProjectVisibility({
  projectId,
  nextVisible,
}) {
  return apiFetch(`/admin/review/project/${projectId}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ nextVisible }),
  });
}

