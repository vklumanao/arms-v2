import {
  buildCenterPayload,
  buildDepartmentPayload,
  getRefMeta,
} from "@/features/admin/utils";
import { apiFetch } from "@/shared/api/httpClient";

export async function fetchReferenceData() {
  const payload = await apiFetch("/admin/controls/reference-data");
  return {
    centersRes: { data: payload?.centers || [], error: null },
    agendasRes: { data: payload?.agendas || [], error: null },
    departmentsRes: { data: payload?.departments || [], error: null },
    proponentsRes: { data: payload?.proponents || [], error: null },
    ckanUsersRes: { data: payload?.ckan_users || [], error: null },
  };
}

export async function createReference({
  type,
  name,
  code,
  center_chief_id,
  chairperson_id,
  research_agendas,
}) {
  const { table } = getRefMeta(type);
  void table;
  const centerPayload = type === "center" ? buildCenterPayload(name) : null;
  const departmentPayload =
    type === "department" ? buildDepartmentPayload(name) : null;
  const payload =
    type === "center"
      ? centerPayload?.name
      : type === "department"
        ? departmentPayload?.name
        : name;
  const finalCode =
    type === "center"
      ? String(code || centerPayload?.code || "").trim()
      : type === "department"
        ? String(code || departmentPayload?.code || "").trim()
        : "";
  try {
    await apiFetch(`/admin/controls/reference/${type}`, {
      method: "POST",
      body: JSON.stringify(
        type === "center"
          ? {
              name: payload,
              code: finalCode || null,
              center_chief_id: center_chief_id || null,
              research_agendas: Array.isArray(research_agendas)
                ? research_agendas
                : [],
            }
          : type === "department"
            ? {
                name: payload,
                code: finalCode || null,
                chairperson_id: chairperson_id || null,
              }
            : { name: payload },
      ),
    });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function createProponentAccount(payload) {
  try {
    const result = await apiFetch("/admin/controls/proponents/accounts", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
    return { data: result?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function updateReference({
  type,
  id,
  name,
  code,
  center_chief_id,
  chairperson_id,
  research_agendas,
}) {
  const { table } = getRefMeta(type);
  void table;
  const payload =
    type === "center"
      ? buildCenterPayload(name).name
      : type === "department"
        ? buildDepartmentPayload(name).name
        : name;
  const centerCode =
    type === "center"
      ? String(code || buildCenterPayload(name).code || "").trim()
      : "";
  const departmentCode =
    type === "department"
      ? String(code || buildDepartmentPayload(name).code || "").trim()
      : "";
  try {
    const result = await apiFetch(`/admin/controls/reference/${type}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(
        type === "center"
          ? {
              name: payload,
              code: centerCode,
              center_chief_id: center_chief_id || null,
              research_agendas: Array.isArray(research_agendas)
                ? research_agendas
                : [],
            }
          : type === "department"
            ? {
                name: payload,
                code: departmentCode,
                chairperson_id: chairperson_id || null,
              }
            : { name: payload },
      ),
    });
    return { data: result?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteReference({ type, id }) {
  try {
    await apiFetch(`/admin/controls/reference/${type}/${id}`, {
      method: "DELETE",
    });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function fetchReferenceUsageCounts({ type, id }) {
  const query = new URLSearchParams({ type, id });
  const payload = await apiFetch(
    `/admin/controls/reference-usage?${query.toString()}`,
  );
  const memberBreakdown = payload?.memberBreakdown || {};
  return {
    projectCount: payload?.projectCount || 0,
    profileCount: payload?.profileCount || 0,
    memberBreakdown: {
      adminCount: Number(memberBreakdown.adminCount || 0),
      editorCount: Number(memberBreakdown.editorCount || 0),
      memberCount: Number(memberBreakdown.memberCount || 0),
      totalCount: Number(memberBreakdown.totalCount || 0),
    },
  };
}

export async function fetchReferenceLinks({ type, id }) {
  const query = new URLSearchParams({ type, id });
  const payload = await apiFetch(
    `/admin/controls/reference-links?${query.toString()}`,
  );
  return {
    profiles: payload?.profiles || [],
    projects: payload?.projects || [],
    agendas: payload?.agendas || [],
  };
}

export async function reassignDependencies({ entity, fromId, toId }) {
  try {
    const payload = await apiFetch("/admin/controls/reassign-dependencies", {
      method: "POST",
      body: JSON.stringify({ entity, fromId, toId }),
    });
    return { data: payload?.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function syncCkanOrganizations() {
  try {
    const payload = await apiFetch("/admin/controls/sync-ckan-orgs", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return { data: payload?.summary || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}


