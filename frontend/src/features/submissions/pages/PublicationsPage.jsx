import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { isLikelyUrl } from "@/shared/utils/validation";
import {
  deletePublication,
  fetchUserProjectsForPublications,
  fetchUserPublications,
  insertPublication,
  updatePublication,
} from "@/features/submissions/services/publicationsService";
import {
  buildProjectMap,
  buildPublicationPayload,
  createPublicationFilters,
  filterPublicationItems,
  INITIAL_PUBLICATION_FORM,
  mapPublicationToForm,
} from "@/features/submissions/utils/publicationsUtils";
import PageHeader from "@/shared/components/layout/PageHeader";
import EmptyState from "@/shared/components/feedback/EmptyState";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import { useToast } from "@/app/providers/ToastProvider";

export default function PublicationsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(INITIAL_PUBLICATION_FORM);
  const [filters, setFilters] = useState(createPublicationFilters());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Action failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Action completed", message);
  }, [message, toast]);

  const loadProjects = async () => {
    const projectsRes = await fetchUserProjectsForPublications({
      userId: user.id,
    });

    if (projectsRes.error) {
      setError(projectsRes.error.message || "Unable to load projects.");
      return;
    }

    setProjects(projectsRes.data || []);
  };

  const loadPublications = async () => {
    const pubsRes = await fetchUserPublications({ userId: user.id });

    if (pubsRes.error) {
      setError(pubsRes.error.message || "Unable to load publications.");
      return;
    }

    setItems(pubsRes.data || []);
  };

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    await Promise.all([loadProjects(), loadPublications()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const projectMap = useMemo(() => buildProjectMap(projects), [projects]);
  const filteredItems = useMemo(
    () => filterPublicationItems(items, filters),
    [items, filters],
  );

  const submit = async (e, confirmed = false) => {
    e?.preventDefault?.();
    setError("");
    setMessage("");
    if (!form.project_id) {
      setError("Please select a related project.");
      return;
    }
    if (!form.title.trim()) {
      setError("Publication title is required.");
      return;
    }
    if (!isLikelyUrl(form.doi_link)) {
      setError("DOI/Link must be a valid URL.");
      return;
    }
    if (!user?.id) {
      setError("Session expired. Please login again.");
      return;
    }
    if (!confirmed) {
      setConfirmAction({
        type: "submit",
        title: form.id
          ? "Confirm Update Publication"
          : "Confirm Add Publication",
        message: form.id
          ? "Save updates to this publication?"
          : "Add this publication record?",
        confirmLabel: form.id ? "Update" : "Add",
      });
      return;
    }

    setSaving(true);
    const payload = buildPublicationPayload(form, user.id);

    if (form.id) {
      const { error: updateError } = await updatePublication({
        publicationId: form.id,
        userId: user.id,
        payload,
      });
      if (updateError) {
        setError(updateError.message || "Unable to update publication.");
        setSaving(false);
        return;
      }
      setMessage("Publication updated.");
    } else {
      const { error: insertError } = await insertPublication({
        payload,
      });
      if (insertError) {
        setError(insertError.message || "Unable to add publication.");
        setSaving(false);
        return;
      }
      setMessage("Publication added.");
    }

    setForm(INITIAL_PUBLICATION_FORM);
    setSaving(false);
    await loadPublications();
  };

  const editItem = (item) => {
    setForm(mapPublicationToForm(item));
  };

  const deleteItem = async (id, confirmed = false) => {
    setError("");
    setMessage("");
    if (!confirmed) {
      setConfirmAction({
        type: "delete",
        id,
        title: "Confirm Delete Publication",
        message: "Delete this publication record?",
        confirmLabel: "Delete",
      });
      return;
    }
    const { error: deleteError } = await deletePublication({
      publicationId: id,
      userId: user.id,
    });
    if (deleteError) {
      setError(deleteError.message || "Unable to delete publication.");
      return;
    }
    setMessage("Publication deleted.");
    if (form.id === id) setForm(INITIAL_PUBLICATION_FORM);
    await loadPublications();
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Publications"
        description="Manage publication and scholarly output records linked to your projects."
      />

      <form className="panel" onSubmit={submit}>
        <div className="panel-header">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            {form.id ? "Edit Publication" : "Add Publication"}
          </h2>
        </div>
        <div className="panel-body grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-semibold text-slate-700">
              Related project
            </span>
            <select
              className="control-select"
              value={form.project_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, project_id: e.target.value }))
              }
              required
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title} ({project.year})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-semibold text-slate-700">
              Publication title
            </span>
            <input
              className="control-input"
              placeholder="Research paper title"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
              required
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Status</span>
            <select
              className="control-select"
              value={form.publication_status}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  publication_status: e.target.value,
                }))
              }
            >
              <option value="">Select status</option>
              <option value="submitted">Submitted</option>
              <option value="presented">Presented</option>
              <option value="published">Published</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Venue</span>
            <input
              className="control-input"
              placeholder="Journal / Conference"
              value={form.venue}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, venue: e.target.value }))
              }
            />
          </label>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-semibold text-slate-700">DOI / Link</span>
            <input
              className="control-input"
              placeholder="https://..."
              value={form.doi_link}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, doi_link: e.target.value }))
              }
            />
          </label>

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={saving}>
              {saving
                ? "Saving..."
                : form.id
                  ? "Update Publication"
                  : "Add Publication"}
            </button>
            {form.id ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setForm(INITIAL_PUBLICATION_FORM)}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </div>
      </form>

      <div className="panel">
        <div className="panel-body grid gap-2 sm:grid-cols-2">
          <input
            className="control-input"
            placeholder="Search publication title"
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
          />
          <select
            className="control-select"
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="">Filter by status</option>
            <option value="submitted">Submitted</option>
            <option value="presented">Presented</option>
            <option value="published">Published</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="panel">
          <div className="panel-body text-sm text-slate-600">
            Loading publications...
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No publications yet"
          description="Add your first publication/output linked to a project."
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const project = projectMap[item.project_id];
            return (
              <article key={item.id} className="panel">
                <div className="panel-body">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-slate-900">
                      {item.title}
                    </h2>
                    <span
                      className={`status-chip status-${(item.publication_status || "unspecified").toLowerCase().replace(/\s+/g, "_")}`}
                    >
                      {item.publication_status || "unspecified"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Project: {project?.title || item.project_id} | Venue:{" "}
                    {item.venue || "-"}
                  </p>
                  {item.doi_link ? (
                    <a
                      href={item.doi_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[var(--brand)]"
                    >
                      {item.doi_link}
                    </a>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn btn-outline"
                      onClick={() => editItem(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger-outline"
                      onClick={() => deleteItem(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        title={confirmAction?.title || "Confirm Action"}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirm"}
        loading={saving}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (!confirmAction) return;
          if (confirmAction.type === "submit") {
            await submit(null, true);
          } else if (confirmAction.type === "delete" && confirmAction.id) {
            await deleteItem(confirmAction.id, true);
          }
          setConfirmAction(null);
        }}
      />
    </section>
  );
}



