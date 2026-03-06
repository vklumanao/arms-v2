import { apiFetch } from "@/shared/api/httpClient";

export async function fetchUserProjectsForPublications({ userId }) {
  void userId;
  try {
    const payload = await apiFetch("/publications/projects-for-user");
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function fetchUserPublications({ userId }) {
  void userId;
  try {
    const payload = await apiFetch("/publications/mine");
    return { data: payload?.data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function updatePublication({ publicationId, userId, payload }) {
  void userId;
  try {
    await apiFetch(`/publications/${publicationId}`, {
      method: "PATCH",
      body: JSON.stringify({ payload }),
    });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function insertPublication({ payload }) {
  try {
    await apiFetch("/publications", {
      method: "POST",
      body: JSON.stringify({ payload }),
    });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function deletePublication({ publicationId, userId }) {
  void userId;
  try {
    await apiFetch(`/publications/${publicationId}`, {
      method: "DELETE",
    });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

