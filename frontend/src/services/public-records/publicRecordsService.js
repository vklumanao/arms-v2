import { apiFetch } from "@/services/httpClient";

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

export async function fetchPublicRecordResources(projectId) {
  try {
    const payload = await apiFetch(`/public-records/${projectId}/resources`);
    return {
      data: payload?.data || { dataset: null, resources: [] },
      syncEnabled: payload?.syncEnabled ?? payload?.data?.syncEnabled ?? true,
      error: null,
    };
  } catch (error) {
    return { data: { dataset: null, resources: [] }, syncEnabled: true, error };
  }
}

