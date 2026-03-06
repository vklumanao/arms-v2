import { apiFetch } from "@/shared/api/httpClient";

export async function fetchPublicRecordsDataset() {
  try {
    const payload = await apiFetch("/public-records");
    return {
      records: payload?.records || [],
      centers: payload?.centers || [],
      departments: payload?.departments || [],
      timelineExists: payload?.timelineExists || {},
      error: null,
    };
  } catch (error) {
    return {
      records: [],
      centers: [],
      departments: [],
      timelineExists: {},
      error,
    };
  }
}

export async function fetchPublicRecordTimeline(projectId) {
  try {
    const payload = await apiFetch(`/public-records/${projectId}/timeline`);
    return { timeline: payload?.timeline || [], error: null };
  } catch (error) {
    return { timeline: [], error };
  }
}

