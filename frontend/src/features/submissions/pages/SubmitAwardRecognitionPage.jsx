import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "@/shared/components/layout/PageHeader";
import { useAuth } from "@/app/providers/AuthProvider";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import { useToast } from "@/app/providers/ToastProvider";
import {
  createAwardRecognitionRecord,
  fetchAwardRecognitionRecord,
  listAwardRecipientOptions,
  updateAwardRecognitionRecord,
  uploadAwardRecognitionMovFile,
} from "@/features/submissions/services";

const LEVEL_OPTIONS = ["Local", "Regional", "National", "International"];
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
  const isAdmin = String(profile?.role || "").toLowerCase() === "admin";
  const missingAffiliation =
    !isAdmin &&
    (!String(profile?.ckan_org_id || "").trim() ||
      !String(profile?.department || "").trim());
  const { centers, departments } = useReferenceData({
    orgId: profile?.ckan_org_id || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState("");
  const [movFile, setMovFile] = useState(null);
  const [existingMov, setExistingMov] = useState(null);
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [form, setForm] = useState({
    work_title: "",
    award_recognition: "",
    awarding_body: "",
    year_received: String(new Date().getFullYear()),
    level: "",
    recipients: "",
    recipient_users: [],
    supporting_movs: "",
    notes: "",
    research_center_id: String(profile?.ckan_org_id || "").trim(),
    department_id: "",
  });

  const defaultDepartmentId = useMemo(() => {
    const profileDepartmentId = String(profile?.ckan_group_id || "").trim();
    const profileDepartment = String(profile?.department || "")
      .trim()
      .toLowerCase();
    if (profileDepartmentId) {
      const matchedDepartment = departments.find(
        (item) =>
          String(item?.id || "")
            .trim()
            .toLowerCase() === profileDepartmentId.toLowerCase(),
      );
      if (matchedDepartment?.id) return matchedDepartment.id;
    }
    if (!profileDepartment) return "";
    return (
      departments.find(
        (item) =>
          String(item?.name || "")
            .trim()
            .toLowerCase() === profileDepartment,
      )?.id || ""
    );
  }, [departments, profile?.ckan_group_id, profile?.department]);

  const effectiveDepartmentId = form.department_id || defaultDepartmentId;
  const centerName =
    centers.find((item) => item.id === form.research_center_id)?.name || "";
  const departmentName =
    departments.find((item) => item.id === effectiveDepartmentId)?.name || "";
  const filteredRecipientOptions = useMemo(() => {
    const query = String(recipientSearch || "").trim().toLowerCase();
    if (!query) return recipientOptions;
    return recipientOptions.filter((item) => {
      const haystack = [
        item?.name,
        item?.username,
        item?.email,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [recipientOptions, recipientSearch]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const updateRecipientUsers = (updater) => {
    setForm((prev) => {
      const nextRecipientUsers =
        typeof updater === "function" ? updater(prev.recipient_users || []) : updater;
      return {
        ...prev,
        recipient_users: nextRecipientUsers,
        recipients: nextRecipientUsers.map((item) => item.name).join(", "),
      };
    });
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
      const { data, error: loadError } = await listAwardRecipientOptions({
        orgId: form.research_center_id,
      });
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
          email: String(item?.email || "").trim(),
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
          .map((item) => selectedById.get(String(item?.id || "").toLowerCase()) || null)
          .filter(Boolean);

        if (!nextRecipientUsers.length) {
          nextRecipientUsers = normalizeNameList(prev.recipients)
            .map((item) => selectedByName.get(item.toLowerCase()) || selectedByEmail.get(item.toLowerCase()) || null)
            .filter(Boolean);
        }

        if (!nextRecipientUsers.length && !editId) {
          const currentUserMatch =
            selectedByEmail.get(String(profile?.email || user?.email || "").toLowerCase()) ||
            selectedByName.get(String(profile?.full_name || user?.full_name || "").toLowerCase()) ||
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
  }, [editId, form.research_center_id, profile?.email, profile?.full_name, user?.email, user?.full_name]);

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
              email: String(item?.email || "").trim(),
            }))
          : [],
        supporting_movs: String(data.supporting_movs || "").trim(),
        notes: String(data.notes || "").trim(),
        research_center_id: String(data.research_center_id || "").trim(),
        department_id: String(data.department_id || "").trim(),
      });
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

  const validate = () => {
    if (!String(form.work_title || "").trim()) {
      return "Title of research/work is required.";
    }
    if (!String(form.award_recognition || "").trim()) {
      return "Award or recognition name is required.";
    }
    if (!String(form.awarding_body || "").trim()) {
      return "Awarding body is required.";
    }
    if (!String(form.year_received || "").trim()) {
      return "Year received is required.";
    }
    if (!/^\d{4}$/.test(String(form.year_received || "").trim())) {
      return "Year received must be a 4-digit year.";
    }
    if (!String(form.level || "").trim()) {
      return "Level is required.";
    }
    if (!Array.isArray(form.recipient_users) || !form.recipient_users.length) {
      return "At least one recipient is required.";
    }
    if (movFile && Number(movFile.size || 0) > MAX_MOV_FILE_SIZE_BYTES) {
      return "MOV file must be 25MB or smaller.";
    }
    if (!isAdmin && !String(form.research_center_id || "").trim()) {
      return "Research center is required.";
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      toast.error("Unable to save award record", validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    const payload = {
      work_title: String(form.work_title || "").trim(),
      award_recognition: String(form.award_recognition || "").trim(),
      awarding_body: String(form.awarding_body || "").trim(),
      year_received: String(form.year_received || "").trim(),
      level: String(form.level || "").trim(),
      recipients: (form.recipient_users || []).map((item) => item.name).join(", "),
      recipient_users: (form.recipient_users || []).map((item) => ({
        id: String(item?.id || "").trim(),
        name: String(item?.name || "").trim(),
        username: String(item?.username || "").trim(),
        email: String(item?.email || "").trim(),
      })),
      supporting_movs: String(form.supporting_movs || "").trim(),
      notes: String(form.notes || "").trim(),
      research_center_id: String(form.research_center_id || "").trim(),
      research_center_name: centerName,
      department_id: String(effectiveDepartmentId || "").trim(),
      program_department: departmentName,
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

    const recordId = String(savedRecord?.id || savedRecord?.ckan_dataset_id || editId).trim();
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

  if (missingAffiliation) {
    return (
      <section className="page-stack-lg">
        <PageHeader
          title="Add Award or Recognition"
          description="Complete your profile affiliation first before creating award records."
        />
        <div className="panel">
          <div className="panel-body space-y-3">
            <p className="text-sm text-amber-700">
              Please set your Organization (Research Center) and Department in
              My Profile first before adding an award or recognition entry.
            </p>
            <Link className="btn btn-primary" to="/my-profile">
              Go to My Profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack-lg">
      <PageHeader
        title={editId ? "Edit Award or Recognition" : "Add Award or Recognition"}
        description={
          editId
            ? "Update the CKAN-backed award record and replace its MOV attachment if needed."
            : "Create a new award record for your research-related accomplishments."
        }
        actions={
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate("/awards-recognitions")}
          >
            Back to Awards
          </button>
        }
      />

      <form className="panel" onSubmit={handleSubmit}>
        {loadingEdit ? (
          <div className="panel-body">
            <p className="text-sm text-slate-600">Loading award record...</p>
          </div>
        ) : null}
        <div className="panel-body grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Title of Research / Work
            </span>
            <input
              className="control-input"
              value={form.work_title}
              onChange={(event) => updateField("work_title", event.target.value)}
              placeholder="Enter the title of the recognized work"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Award / Recognition
            </span>
            <input
              className="control-input"
              value={form.award_recognition}
              onChange={(event) =>
                updateField("award_recognition", event.target.value)
              }
              placeholder="Best Paper Award, Recognition for Innovation, etc."
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Awarding Body
            </span>
            <input
              className="control-input"
              value={form.awarding_body}
              onChange={(event) =>
                updateField("awarding_body", event.target.value)
              }
              placeholder="Conference organizer, institution, agency"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Year Received
            </span>
            <input
              className="control-input"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={form.year_received}
              onChange={(event) =>
                updateField("year_received", sanitizeDigits(event.target.value, 4))
              }
              placeholder="2026"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Level</span>
            <select
              className="control-select"
              value={form.level}
              onChange={(event) => updateField("level", event.target.value)}
            >
              <option value="">Select level</option>
              {LEVEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Recipient(s)
            </span>
            <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3">
              <input
                className="control-input"
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Search CKAN users by name, username, or email"
              />
              <div className="flex flex-wrap gap-2">
                {(form.recipient_users || []).length ? (
                  form.recipient_users.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="status-chip status-ongoing"
                      onClick={() =>
                        updateRecipientUsers((prev) =>
                          prev.filter((entry) => entry.id !== item.id),
                        )
                      }
                      title="Remove recipient"
                    >
                      {item.name}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">
                    No recipients selected yet.
                  </span>
                )}
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                {loadingRecipients ? (
                  <p className="text-sm text-slate-500">Loading CKAN users...</p>
                ) : filteredRecipientOptions.length ? (
                  filteredRecipientOptions.map((option) => {
                    const checked = (form.recipient_users || []).some(
                      (item) => item.id === option.id,
                    );
                    return (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            updateRecipientUsers((prev) => {
                              if (prev.some((item) => item.id === option.id)) {
                                return prev.filter((item) => item.id !== option.id);
                              }
                              return [...prev, option];
                            })
                          }
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block font-medium text-slate-800">
                            {option.name}
                          </span>
                          <span className="block truncate text-slate-500">
                            {[option.username, option.email].filter(Boolean).join(" | ")}
                          </span>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">
                    No CKAN users found for the selected research center.
                  </p>
                )}
              </div>
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Research Center
            </span>
            <select
              className="control-select"
              value={form.research_center_id}
              onChange={(event) =>
                updateField("research_center_id", event.target.value)
              }
              disabled={!isAdmin}
            >
              <option value="">Select research center</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Department
            </span>
            <select
              className="control-select"
              value={effectiveDepartmentId}
              onChange={(event) => updateField("department_id", event.target.value)}
              disabled={!isAdmin && Boolean(defaultDepartmentId)}
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Supporting MOV Reference
            </span>
            <input
              className="control-input"
              value={form.supporting_movs}
              onChange={(event) =>
                updateField("supporting_movs", event.target.value)
              }
              placeholder="Drive link, repository URL, or MOV reference"
            />
          </label>

          <div className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Supporting MOV File
            </span>
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
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
                        ? "Current CKAN resource attached to this award record"
                        : "Upload a file to store the supporting MOV as a CKAN resource"}
                  </p>
                </div>
                <label className="btn btn-outline cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setMovFile(file);
                    }}
                  />
                  {movFile || existingMov ? "Replace File" : "Choose File"}
                </label>
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
          </div>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Notes</span>
            <textarea
              className="control-input min-h-28"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Additional context about the award or recognition"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
          <p className="text-sm text-rose-700">{error || " "}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate("/awards-recognitions")}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? editId
                  ? "Updating..."
                  : "Saving..."
                : editId
                  ? "Update Award Record"
                  : "Save Award Record"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
