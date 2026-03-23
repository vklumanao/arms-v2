import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createAwardRecognitionRecord,
  fetchAwardRecognitionRecord,
  fetchUserProjects,
  listAwardRecipientOptions,
  updateAwardRecognitionRecord,
  uploadAwardRecognitionMovFile,
} from "@/services/submissions";

const LEVEL_OPTIONS = [
  "Institutional",
  "Local",
  "Regional",
  "National",
  "International",
];
const MAX_MOV_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const normalizeNameList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function SubmitAwardRecognitionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { user, profile } = useAuth();
  const editId = String(searchParams.get("edit") || "").trim();
  const prefillProjectId = String(searchParams.get("project_id") || "").trim();
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState("");
  const [movFile, setMovFile] = useState(null);
  const [existingMov, setExistingMov] = useState(null);
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [projectOptions, setProjectOptions] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [form, setForm] = useState({
    work_title: "",
    project_id: "",
    award_recognition: "",
    awarding_body: "",
    year_received: String(new Date().getFullYear()),
    level: "",
    recipients: "",
    recipient_users: [],
    supporting_movs: "",
    notes: "",
  });
  const filteredRecipientOptions = useMemo(() => {
    const query = String(recipientSearch || "")
      .trim()
      .toLowerCase();
    return recipientOptions.filter((item) => {
      const alreadySelected = (form.recipient_users || []).some(
        (selected) => selected.id === item.id,
      );
      if (alreadySelected) return false;
      const haystack = [item?.name, item?.username, item?.email]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      if (!query) return false;
      return haystack.includes(query);
    });
  }, [form.recipient_users, recipientOptions, recipientSearch]);
  const normalizedProjectOptions = useMemo(() => {
    const normalized = (Array.isArray(projectOptions) ? projectOptions : [])
      .map((item) => ({
        id: String(item?.id || item?.ckan_dataset_id || "").trim(),
        title: String(item?.title || "").trim(),
        year: String(item?.year || "").trim(),
      }))
      .filter((item) => item.id && item.title);
    normalized.sort((a, b) => a.title.localeCompare(b.title));
    return normalized;
  }, [projectOptions]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const updateRecipientUsers = (updater) => {
    setForm((prev) => {
      const nextRecipientUsers =
        typeof updater === "function"
          ? updater(prev.recipient_users || [])
          : updater;
      return {
        ...prev,
        recipient_users: nextRecipientUsers,
        recipients: nextRecipientUsers.map((item) => item.name).join(", "),
      };
    });
  };
  const addRecipientUser = (option) => {
    if (!option?.id) return;
    updateRecipientUsers((prev) => {
      if (prev.some((item) => item.id === option.id)) return prev;
      return [...prev, option];
    });
    setRecipientSearch("");
  };
  const sanitizeDigits = (value, maxLength = null) => {
    const digitsOnly = String(value || "").replace(/\D+/g, "");
    if (maxLength == null) return digitsOnly;
    return digitsOnly.slice(0, maxLength);
  };

  useEffect(() => {
    let cancelled = false;
    const loadRecipients = async () => {
      setLoadingRecipients(true);
      const { data, error: loadError } = await listAwardRecipientOptions();
      if (cancelled) return;
      if (loadError) {
        setRecipientOptions([]);
        setLoadingRecipients(false);
        return;
      }

      const normalized = (Array.isArray(data) ? data : [])
        .map((item) => ({
          id: String(item?.id || "").trim(),
          name: String(item?.name || "").trim(),
          username: String(item?.username || "").trim(),
          email: String(item?.email || "").trim() || null,
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      setRecipientOptions(normalized);
      setLoadingRecipients(false);

      setForm((prev) => {
        const selectedById = new Map(
          normalized.map((item) => [String(item.id).toLowerCase(), item]),
        );
        const selectedByName = new Map(
          normalized.map((item) => [String(item.name).toLowerCase(), item]),
        );
        const selectedByEmail = new Map(
          normalized
            .filter((item) => item.email)
            .map((item) => [String(item.email).toLowerCase(), item]),
        );
        let nextRecipientUsers = (prev.recipient_users || [])
          .map(
            (item) =>
              selectedById.get(String(item?.id || "").toLowerCase()) || null,
          )
          .filter(Boolean);

        if (!nextRecipientUsers.length) {
          nextRecipientUsers = normalizeNameList(prev.recipients)
            .map(
              (item) =>
                selectedByName.get(item.toLowerCase()) ||
                selectedByEmail.get(item.toLowerCase()) ||
                null,
            )
            .filter(Boolean);
        }

        if (!nextRecipientUsers.length && !editId) {
          const currentUserMatch =
            selectedByEmail.get(
              String(profile?.email || user?.email || "").toLowerCase(),
            ) ||
            selectedByName.get(
              String(profile?.full_name || user?.full_name || "").toLowerCase(),
            ) ||
            null;
          if (currentUserMatch) nextRecipientUsers = [currentUserMatch];
        }

        return {
          ...prev,
          recipient_users: nextRecipientUsers,
          recipients: nextRecipientUsers.length
            ? nextRecipientUsers.map((item) => item.name).join(", ")
            : prev.recipients,
        };
      });
    };

    loadRecipients();
    return () => {
      cancelled = true;
    };
  }, [
    editId,
    profile?.email,
    profile?.full_name,
    user?.email,
    user?.full_name,
  ]);

  useEffect(() => {
    const userId = profile?.id || user?.id;
    if (!userId) {
      setProjectOptions([]);
      return () => {};
    }
    let cancelled = false;
    setLoadingProjects(true);
    fetchUserProjects({ userId })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setProjectOptions([]);
          setLoadingProjects(false);
          return;
        }
        setProjectOptions(Array.isArray(data) ? data : []);
        setLoadingProjects(false);
      })
      .catch(() => {
        if (cancelled) return;
        setProjectOptions([]);
        setLoadingProjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, user?.id]);

  useEffect(() => {
    const currentTitle = String(form.work_title || "").trim();
    const currentProjectId = String(form.project_id || "").trim();
    if (!currentTitle) {
      setSelectedProjectId("");
      if (currentProjectId) updateField("project_id", "");
      return;
    }
    const match = normalizedProjectOptions.find(
      (item) => item.title.toLowerCase() === currentTitle.toLowerCase(),
    );
    if (match) {
      setSelectedProjectId(match.id);
      if (currentProjectId !== match.id) updateField("project_id", match.id);
      return;
    }
    setSelectedProjectId("__custom__");
    if (currentProjectId) updateField("project_id", "");
  }, [form.work_title, normalizedProjectOptions]);

  useEffect(() => {
    if (editId) return;
    if (!prefillProjectId) return;
    const hasProject = String(form.project_id || "").trim();
    const hasTitle = String(form.work_title || "").trim();
    if (hasProject || hasTitle) return;
    const match = normalizedProjectOptions.find(
      (item) => item.id === prefillProjectId,
    );
    setForm((prev) => ({
      ...prev,
      project_id: prefillProjectId,
      work_title: match?.title || prev.work_title,
    }));
    setSelectedProjectId(prefillProjectId);
  }, [
    editId,
    form.project_id,
    form.work_title,
    normalizedProjectOptions,
    prefillProjectId,
  ]);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoadingEdit(true);
    setError("");

    fetchAwardRecognitionRecord(editId).then(({ data, error: loadError }) => {
      if (cancelled) return;
      if (loadError || !data) {
        setError(loadError?.message || "Unable to load award record.");
        setLoadingEdit(false);
        return;
      }

      setForm({
        work_title: String(data.work_title || "").trim(),
        project_id: String(data.project_id || "").trim(),
        award_recognition: String(data.award_recognition || "").trim(),
        awarding_body: String(data.awarding_body || "").trim(),
        year_received:
          String(data.year_received || "").trim() ||
          String(new Date().getFullYear()),
        level: String(data.level || "").trim(),
        recipients: String(data.recipients || "").trim(),
        recipient_users: Array.isArray(data.recipient_users)
          ? data.recipient_users.map((item) => ({
              id: String(item?.id || "").trim(),
              name: String(item?.name || "").trim(),
              username: String(item?.username || "").trim(),
              email: String(item?.email || "").trim() || null,
            }))
          : [],
        supporting_movs: String(data.supporting_movs || "").trim(),
        notes: String(data.notes || "").trim(),
      });
      setSelectedProjectId(
        String(data.project_id || "").trim() || "__custom__",
      );
      setExistingMov(
        data.supporting_mov_file_path
          ? {
              resourceId: data.supporting_mov_resource_id || "",
              fileName:
                data.supporting_mov_file_name ||
                data.supporting_mov_file_path ||
                "Supporting MOV",
              filePath: data.supporting_mov_file_path,
              mimeType: data.supporting_mov_file_mime_type || "",
              fileSize: data.supporting_mov_file_size || null,
            }
          : null,
      );
      setLoadingEdit(false);
    });

    return () => {
      cancelled = true;
    };
  }, [editId]);

  const formatFileSize = (bytes) => {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFields = () => {
    const errors = {};
    if (!String(form.award_recognition || "").trim()) {
      errors.award_recognition = "Award or recognition name is required.";
    }
    if (!String(form.awarding_body || "").trim()) {
      errors.awarding_body = "Awarding body is required.";
    }
    if (!String(form.year_received || "").trim()) {
      errors.year_received = "Year received is required.";
    }
    if (
      String(form.year_received || "").trim() &&
      !/^\d{4}$/.test(String(form.year_received || "").trim())
    ) {
      errors.year_received = "Year received must be a 4-digit year.";
    }
    if (!String(form.level || "").trim()) {
      errors.level = "Level is required.";
    }
    if (!Array.isArray(form.recipient_users) || !form.recipient_users.length) {
      errors.recipients = "At least one recipient is required.";
    }
    if (movFile && Number(movFile.size || 0) > MAX_MOV_FILE_SIZE_BYTES) {
      errors.supporting_movs = "MOV file must be 25MB or smaller.";
    }
    return errors;
  };
  const fieldErrors = useMemo(
    () => validateFields(),
    [
      form.award_recognition,
      form.awarding_body,
      form.level,
      form.recipient_users,
      form.work_title,
      form.year_received,
      movFile,
    ],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateFields();
    const firstError = errors[Object.keys(errors)[0]] || "";
    if (firstError) {
      setError(firstError);
      toast.error("Unable to save award record", firstError);
      return;
    }

    setSubmitting(true);
    setError("");

    const payload = {
      work_title: String(form.work_title || "").trim(),
      project_id: String(form.project_id || "").trim() || null,
      award_recognition: String(form.award_recognition || "").trim(),
      awarding_body: String(form.awarding_body || "").trim(),
      year_received: String(form.year_received || "").trim(),
      level: String(form.level || "").trim(),
      recipients: (form.recipient_users || [])
        .map((item) => item.name)
        .join(", "),
      recipient_users: (form.recipient_users || []).map((item) => ({
        id: String(item?.id || "").trim(),
        name: String(item?.name || "").trim(),
        username: String(item?.username || "").trim(),
        email: String(item?.email || "").trim() || null,
      })),
      supporting_movs: String(form.supporting_movs || "").trim(),
      notes: String(form.notes || "").trim(),
    };

    const saveAction = editId
      ? updateAwardRecognitionRecord(editId, payload)
      : createAwardRecognitionRecord(payload);
    const { data: savedRecord, error: saveError } = await saveAction;
    if (saveError) {
      setError(saveError.message || "Unable to save award record.");
      toast.error(
        "Unable to save award record",
        saveError.message || "Please try again.",
      );
      setSubmitting(false);
      return;
    }

    const recordId = String(
      savedRecord?.id || savedRecord?.ckan_dataset_id || editId,
    ).trim();
    if (movFile && recordId) {
      const { error: uploadError } = await uploadAwardRecognitionMovFile({
        recordId,
        file: movFile,
      });
      if (uploadError) {
        setError(uploadError.message || "Unable to upload supporting MOV.");
        toast.error(
          "Award saved but MOV upload failed",
          uploadError.message || "Please retry the file upload.",
        );
        setSubmitting(false);
        return;
      }
    }

    toast.success(
      editId ? "Award record updated" : "Award record saved",
      editId
        ? "The awards and recognition entry was updated successfully."
        : "The awards and recognition entry was added to your workspace.",
    );
    setSubmitting(false);
    navigate("/awards-recognitions");
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title={
          editId ? "Edit Award or Recognition" : "Add Award or Recognition"
        }
        description={
          editId
            ? "Update the award record and replace its MOV attachment if needed."
            : "Create a new award record for your research-related accomplishments."
        }
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/awards-recognitions")}
          >
            Back to Awards
          </Button>
        }
      />

      <form onSubmit={handleSubmit}>
        <Card>
          {loadingEdit ? (
            <CardContent className="p-5">
              <p className="text-sm text-slate-600">Loading award record...</p>
            </CardContent>
          ) : null}
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Award / Recognition
              </span>
              <Input
                value={form.award_recognition}
                onChange={(event) =>
                  updateField("award_recognition", event.target.value)
                }
                placeholder="Best Paper Award, Recognition for Innovation, etc."
                className={fieldErrors.award_recognition ? "input-error" : ""}
              />
              {fieldErrors.award_recognition ? (
                <p className="field-error">{fieldErrors.award_recognition}</p>
              ) : null}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Awarding Body
              </span>
              <Input
                value={form.awarding_body}
                onChange={(event) =>
                  updateField("awarding_body", event.target.value)
                }
                placeholder="Conference organizer, institution, agency"
                className={fieldErrors.awarding_body ? "input-error" : ""}
              />
              {fieldErrors.awarding_body ? (
                <p className="field-error">{fieldErrors.awarding_body}</p>
              ) : null}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Year Received
              </span>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={form.year_received}
                onChange={(event) =>
                  updateField(
                    "year_received",
                    sanitizeDigits(event.target.value, 4),
                  )
                }
                placeholder="2026"
                className={fieldErrors.year_received ? "input-error" : ""}
              />
              {fieldErrors.year_received ? (
                <p className="field-error">{fieldErrors.year_received}</p>
              ) : null}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Level
              </span>
              <Select
                value={form.level}
                onValueChange={(value) => updateField("level", value)}
              >
                <SelectTrigger
                  className={fieldErrors.level ? "input-error" : ""}
                >
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.level ? (
                <p className="field-error">{fieldErrors.level}</p>
              ) : null}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Title of Research (Optional)
              </span>
              <Select
                value={selectedProjectId || "__none__"}
                onValueChange={(value) => {
                  if (value === "__none__") {
                    setSelectedProjectId("");
                    updateField("work_title", "");
                    updateField("project_id", "");
                    return;
                  }
                  if (value === "__custom__") return;
                  const selected = normalizedProjectOptions.find(
                    (item) => item.id === value,
                  );
                  setSelectedProjectId(value);
                  updateField("work_title", selected?.title || "");
                  updateField("project_id", selected?.id || "");
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingProjects ? "Loading projects..." : "Select project"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select project</SelectItem>
                  {selectedProjectId === "__custom__" && form.work_title ? (
                    <SelectItem value="__custom__">
                      Current entry: {form.work_title}
                    </SelectItem>
                  ) : null}
                  {normalizedProjectOptions.length ? (
                    normalizedProjectOptions.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                        {project.year ? ` (${project.year})` : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty__" disabled>
                      No project entries found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {fieldErrors.work_title ? (
                <p className="field-error">{fieldErrors.work_title}</p>
              ) : null}
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Recipient(s)
              </span>
              <div className="space-y-2 rounded-md border bg-white p-3">
                <Input
                  value={recipientSearch}
                  onChange={(event) => setRecipientSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && filteredRecipientOptions[0]) {
                      event.preventDefault();
                      addRecipientUser(filteredRecipientOptions[0]);
                    }
                  }}
                  placeholder="Type a name to search Faculty"
                  className={fieldErrors.recipients ? "input-error" : ""}
                />
                <div className="flex flex-wrap gap-2">
                  {(form.recipient_users || []).length ? (
                    form.recipient_users.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        onClick={() =>
                          updateRecipientUsers((prev) =>
                            prev.filter((entry) => entry.id !== item.id),
                          )
                        }
                        title="Remove recipient"
                      >
                        {item.name}
                      </Button>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">
                      No recipients selected yet.
                    </span>
                  )}
                </div>
                {loadingRecipients ? (
                  <p className="text-sm text-slate-500">Loading users...</p>
                ) : recipientSearch.trim() ? (
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-2">
                    {filteredRecipientOptions.length ? (
                      filteredRecipientOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left hover:bg-white"
                          onClick={() => addRecipientUser(option)}
                        >
                          <span className="min-w-0 text-sm">
                            <span className="block font-medium text-slate-800">
                              {option.name}
                            </span>
                            <span className="block truncate text-slate-500">
                              {[option.username, option.email]
                                .filter(Boolean)
                                .join(" | ")}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No matching Faculty found.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Start typing a recipient name to search Faculty.
                  </p>
                )}
              </div>
              {fieldErrors.recipients ? (
                <p className="field-error">{fieldErrors.recipients}</p>
              ) : null}
            </label>

            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Supporting MOV File
              </span>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-800">
                      {movFile?.name ||
                        existingMov?.fileName ||
                        "No supporting MOV file attached yet"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {movFile
                        ? `${formatFileSize(movFile.size)} selected for upload`
                        : existingMov?.filePath
                          ? "Current Faculty resource attached to this award record"
                          : "Upload a file to store the supporting MOV as a Faculty resource"}
                    </p>
                  </div>
                  <Button variant="outline" asChild>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setMovFile(file);
                        }}
                      />
                      {movFile || existingMov ? "Replace File" : "Choose File"}
                    </label>
                  </Button>
                </div>
                {existingMov?.filePath && !movFile ? (
                  <a
                    href={existingMov.filePath}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900"
                  >
                    Open current MOV attachment
                  </a>
                ) : null}
              </div>
              {fieldErrors.supporting_movs ? (
                <p className="field-error">{fieldErrors.supporting_movs}</p>
              ) : null}
            </div>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Supporting MOV Reference
              </span>
              <Input
                value={form.supporting_movs}
                onChange={(event) =>
                  updateField("supporting_movs", event.target.value)
                }
                placeholder="Drive link, repository URL, or MOV reference"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Notes
              </span>
              <Textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Additional context about the award or recognition"
              />
            </label>
          </CardContent>

          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
            <p className="text-sm text-rose-700">{error || " "}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/awards-recognitions")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? editId
                    ? "Updating..."
                    : "Saving..."
                  : editId
                    ? "Update Award Record"
                    : "Save Award Record"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </section>
  );
}
