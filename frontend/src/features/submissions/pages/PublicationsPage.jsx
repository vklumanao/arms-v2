import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { isLikelyUrl } from "@/shared/utils/validation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  deletePublication,
  fetchUserProjectsForPublications,
  fetchUserPublications,
  insertPublication,
  updatePublication,
} from "@/features/submissions/services";
import {
  buildProjectMap,
  buildPublicationPayload,
  createPublicationFilters,
  filterPublicationItems,
  INITIAL_PUBLICATION_FORM,
  mapPublicationToForm,
} from "@/features/submissions/utils";
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

  const statusToneClassName = (status) => {
    if (status === "published" || status === "approved") {
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    }
    if (status === "presented") return "border-sky-200 bg-sky-50 text-sky-900";
    if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-900";
    if (status === "submitted") return "border-amber-200 bg-amber-50 text-amber-900";
    return "border-slate-200 bg-slate-50 text-slate-700";
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Publications"
        description="Manage publication and scholarly output records linked to your projects."
      />

      <form onSubmit={submit}>
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
              {form.id ? "Edit Publication" : "Add Publication"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-semibold text-slate-700">
              Related project
            </span>
            <Select
              value={form.project_id || "__none__"}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  project_id: value === "__none__" ? "" : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.title} ({project.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-semibold text-slate-700">
              Publication title
            </span>
            <Input
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
            <Select
              value={form.publication_status || "__none__"}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  publication_status: value === "__none__" ? "" : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="presented">Presented</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Venue</span>
            <Input
              placeholder="Journal / Conference"
              value={form.venue}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, venue: e.target.value }))
              }
            />
          </label>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-semibold text-slate-700">DOI / Link</span>
            <Input
              placeholder="https://..."
              value={form.doi_link}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, doi_link: e.target.value }))
              }
            />
          </label>

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : form.id
                  ? "Update Publication"
                  : "Add Publication"}
            </Button>
            {form.id ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm(INITIAL_PUBLICATION_FORM)}
              >
                Cancel Edit
              </Button>
            ) : null}
          </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardContent className="grid gap-2 p-5 sm:grid-cols-2">
          <Input
            placeholder="Search publication title"
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
          />
          <Select
            value={filters.status || "__all__"}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                status: value === "__all__" ? "" : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="presented">Presented</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-5 text-sm text-slate-600">
            Loading publications...
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No publications yet"
          description="Add your first publication/output linked to a project."
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const project = projectMap[item.project_id];
            const normalizedStatus = String(item.publication_status || "unspecified")
              .toLowerCase()
              .replace(/\s+/g, "_");
            return (
              <Card key={item.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-slate-900">
                      {item.title}
                    </h2>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        statusToneClassName(normalizedStatus),
                      )}
                    >
                      {item.publication_status || "unspecified"}
                    </Badge>
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
                    <Button type="button" variant="outline" onClick={() => editItem(item)}>
                      Edit
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => deleteItem(item.id)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
