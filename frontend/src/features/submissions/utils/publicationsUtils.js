export const INITIAL_PUBLICATION_FORM = {
  id: null,
  project_id: "",
  title: "",
  publication_status: "",
  venue: "",
  doi_link: "",
};

export function createPublicationFilters() {
  return { search: "", status: "" };
}

export function filterPublicationItems(items, filters) {
  return (items || []).filter((item) => {
    if (
      filters.search &&
      !String(item.title || "")
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    if (filters.status && item.publication_status !== filters.status) {
      return false;
    }
    return true;
  });
}

export function buildProjectMap(projects) {
  return (projects || []).reduce((acc, project) => {
    if (project?.id) acc[project.id] = project;
    return acc;
  }, {});
}

export function mapPublicationToForm(item) {
  return {
    id: item.id,
    project_id: item.project_id || "",
    title: item.title || "",
    publication_status: item.publication_status || "",
    venue: item.venue || "",
    doi_link: item.doi_link || "",
  };
}

export function buildPublicationPayload(form, userId) {
  return {
    project_id: form.project_id,
    title: form.title.trim(),
    publication_status: form.publication_status || null,
    venue: form.venue || null,
    doi_link: form.doi_link || null,
    created_by: userId,
  };
}

