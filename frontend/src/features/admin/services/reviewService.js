import { apiFetch } from "@/shared/api/httpClient";

export async function reviewSubmissionDecision({
  projectId,
  action,
  comments,
}) {
  try {
    await apiFetch("/admin/review/review-decision", {
      method: "POST",
      body: JSON.stringify({ projectId, action, comments: comments || null }),
    });
    return null;
  } catch (error) {
    return error;
  }
}

