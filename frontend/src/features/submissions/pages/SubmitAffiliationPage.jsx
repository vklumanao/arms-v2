import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleDot, FileText, Loader2, Lock, Upload } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import {
  fetchCkanOrganizationAgendas,
  fetchCkanUsers,
} from "@/shared/api/ckanApi";
import { isLikelyUrl } from "@/shared/utils/validation";
import {
  fetchEditableSubmission,
  fetchProjectExpectedOutputs,
  removeExpectedOutputFilesFromStorage,
  saveDraftSubmission,
  saveSubmission,
} from "@/features/submissions/services";
import {
  removeMovFilesFromStorage,
  uploadMovFileToStorage,
} from "@/features/submissions/services";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import {
  canAccessSubmissionStep,
  clampSubmissionStep,
  getHighestUnlockedSubmissionStep,
  EXPECTED_OUTPUT_TYPE_OPTIONS,
  getSubmissionDraftKey,
  INITIAL_SUBMISSION_FORM,
  mapProjectToSubmissionForm,
  mapDbOutputToLocalRow,
  parseSavedSubmissionDraft,
  sanitizeFileName,
  splitCsvNames,
  SUBMISSION_STEPS,
  toCsvNames,
  createLocalOutputRow,
  buildExpectedOutputsSummary,
  validateSubmissionStep,
} from "@/features/submissions/utils";
import PageHeader from "@/shared/components/layout/PageHeader";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { useToast } from "@/app/providers/ToastProvider";

const MAX_MOA_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_OUTPUT_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const PRODUCT_SOFTWARE_SPECIFIC_OUTPUT_OPTIONS = [
  "Software Applications",
  "Video Games",
  "Websites and Web Systems",
  "Digital Art and Generative Art",
  "Interactive Media Projects",
  "Data Visualization Projects",
  "Artificial Intelligence Creations",
  "Educational Technology Tools",
];

export default function SubmitAffiliationPage() {
  const EXPECTED_OUTPUTS_PAGE_SIZE = 10;
  const toast = useToast();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get("edit");
  const {
    centers,
    departments,
    error: referenceError,
  } = useReferenceData({ orgId: profile?.ckan_org_id || "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submissionState, setSubmissionState] = useState(null);
  const [form, setForm] = useState(INITIAL_SUBMISSION_FORM);
  const [orgAgendaOptions, setOrgAgendaOptions] = useState([]);
  const [ckanUsers, setCkanUsers] = useState([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [facultySearch, setFacultySearch] = useState("");
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const [facultyDropdownOpen, setFacultyDropdownOpen] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [moaFile, setMoaFile] = useState(null);
  const [expectedOutputRows, setExpectedOutputRows] = useState([]);
  const [showAddOutputModal, setShowAddOutputModal] = useState(false);
  const [editingOutputClientId, setEditingOutputClientId] = useState(null);
  const [newOutputDraft, setNewOutputDraft] = useState(() =>
    createLocalOutputRow(),
  );
  const [expectedOutputsPage, setExpectedOutputsPage] = useState(1);
  const skipNextAutosaveRef = useRef(false);
  const hasDraftExpectedOutputsRef = useRef(false);
  const leadFieldRef = useRef(null);
  const facultyFieldRef = useRef(null);
  const disabledButtonClass =
    "disabled:!border-[var(--border-strong)] disabled:!bg-[var(--surface-strong)] disabled:!text-[var(--text-muted)] disabled:cursor-not-allowed";
  const disabledOutlineButtonClass =
    "disabled:!border-[var(--border-strong)] disabled:!bg-[var(--surface-muted)] disabled:!text-[var(--text-muted)] disabled:cursor-not-allowed";
  const sanitizeDigits = (value, maxLength = null) => {
    const digitsOnly = String(value || "").replace(/\D+/g, "");
    if (maxLength == null) return digitsOnly;
    return digitsOnly.slice(0, maxLength);
  };
  const sanitizeDecimal = (value) => {
    const text = String(value || "").replace(/[^\d.]/g, "");
    const [whole = "", ...rest] = text.split(".");
    const decimal = rest.join("");
    return decimal ? `${whole}.${decimal}` : whole;
  };

  const formatFileSize = (bytes) => {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return "-";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };
  const fileToBase64 = async (file) => {
    if (!file) return "";
    const arrayBuffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const draftKey = useMemo(
    () => getSubmissionDraftKey(user?.id, editId),
    [user?.id, editId],
  );
  const noticeError = error || referenceError?.message || "";

  useEffect(() => {
    if (!noticeError) return;
    toast.error("Submission failed", noticeError);
  }, [noticeError, toast]);

  useEffect(() => {
    if (!message) return;
    toast.success("Submission received", message);
  }, [message, toast]);

  useEffect(() => {
    if (!user?.id || !editId) return;
    setLoadingEdit(true);
    fetchEditableSubmission({ projectId: editId })
      .then(async ({ data, error: fetchError }) => {
        if (fetchError || !data) {
          setError("Unable to load submission for revision.");
          return;
        }
        setSubmissionState(
          String(data?.submission_state || "submitted").trim().toLowerCase(),
        );
        setForm(mapProjectToSubmissionForm(data));
        if (
          String(data?.submission_state || "").trim().toLowerCase() ===
            "draft" &&
          typeof data?.draft_step === "number"
        ) {
          setStep(clampSubmissionStep(data.draft_step));
        }

        const { data: outputData, error: outputError } =
          await fetchProjectExpectedOutputs({ projectId: editId });
        if (outputError) {
          setError(
            outputError.message || "Unable to load expected output records.",
          );
          return;
        }

        const mappedRows = (outputData || []).map(mapDbOutputToLocalRow);
        setExpectedOutputRows((prev) =>
          hasDraftExpectedOutputsRef.current ? prev : mappedRows,
        );
      })
      .finally(() => setLoadingEdit(false));
  }, [editId, user?.id]);

  useEffect(() => {
    if (editId) {
      // Server-backed drafts/edits should hydrate from the backend, not localStorage.
      setDraftHydrated(true);
      return;
    }
    if (!draftKey) return;
    setDraftHydrated(false);
    const parsed = parseSavedSubmissionDraft(localStorage.getItem(draftKey));
    if (parsed?.form) {
      setForm((prev) => ({ ...prev, ...parsed.form }));
      if (typeof parsed.step === "number") {
        setStep(clampSubmissionStep(parsed.step));
      }
    }
    if (Array.isArray(parsed?.expectedOutputRows)) {
      hasDraftExpectedOutputsRef.current = parsed.expectedOutputRows.length > 0;
      setExpectedOutputRows(
          parsed.expectedOutputRows.map((row) => ({
            ...createLocalOutputRow(),
            ...row,
            target_count: Math.max(1, Number(row.target_count) || 1),
            specific_output: String(row?.specific_output || "").trim(),
            file: null,
            file_base64: String(row?.file_base64 || "").trim(),
            needs_file_reselect: Boolean(
              !row.file_path && row.needs_file_reselect,
            ),
          })),
        );
    } else {
      hasDraftExpectedOutputsRef.current = false;
    }
    setDraftHydrated(true);
  }, [draftKey, editId]);

    useEffect(() => {
      if (editId) return;
      if (!draftKey) return;
      if (!draftHydrated) return;
      if (skipNextAutosaveRef.current) {
        skipNextAutosaveRef.current = false;
        return;
      }
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            step,
            form,
            expectedOutputRows: expectedOutputRows.map((row) => ({
              id: row.id,
              client_id: row.client_id,
              output_type: row.output_type,
              target_count: Math.max(1, Number(row.target_count) || 1),
              specific_output: row.specific_output || "",
              notes: row.notes,
              file_path: row.file_path,
              file_name: row.file_name,
              mime_type: row.mime_type,
              file_size: row.file_size,
              // Never persist base64 in localStorage to avoid quota issues.
              file_base64: "",
              is_saved: row.is_saved,
              needs_file_reselect: Boolean(
                !row.file_path && !row.file_name && Boolean(row.file),
              ),
            })),
            savedAt: new Date().toISOString(),
          }),
        );
      } catch (error) {
        console.warn("Draft autosave failed", error);
      }
    }, [draftKey, step, form, draftHydrated, expectedOutputRows, editId]);

  useEffect(() => {
    const orgId = String(profile?.ckan_org_id || "").trim();
    let cancelled = false;
    if (!orgId) {
      setOrgAgendaOptions([]);
      return () => {
        cancelled = true;
      };
    }
    fetchCkanOrganizationAgendas(orgId)
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setOrgAgendaOptions(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setOrgAgendaOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.ckan_org_id]);

  useEffect(() => {
    let cancelled = false;
    fetchCkanUsers()
      .then((payload) => {
        if (cancelled) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setCkanUsers(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setCkanUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const effectiveAgendas = useMemo(() => {
    return orgAgendaOptions;
  }, [orgAgendaOptions]);

  useEffect(() => {
    if (!form.research_agenda_id) return;
    const stillExists = effectiveAgendas.some(
      (item) =>
        String(item?.id || "") === String(form.research_agenda_id || ""),
    );
    if (stillExists) return;
    setForm((prev) => ({
      ...prev,
      research_agenda_id: "",
    }));
  }, [effectiveAgendas, form.research_agenda_id]);

  useEffect(() => {
    if (editId) return;
    const profileCenterId = profile?.ckan_org_id || "";
    if (!profileCenterId) return;
    setForm((prev) => {
      // Keep new submissions aligned to the current profile organization.
      // This prevents stale local draft values from showing old/unmapped org ids.
      if (prev.research_center_id === profileCenterId) return prev;
      return {
        ...prev,
        research_center_id: profileCenterId,
      };
    });
  }, [editId, profile?.ckan_org_id]);

  const highestUnlockedStep = useMemo(() => {
    return getHighestUnlockedSubmissionStep(form, expectedOutputRows);
  }, [form, expectedOutputRows]);
  const progressPercent = useMemo(
    () => Math.round(((step + 1) / SUBMISSION_STEPS.length) * 100),
    [step],
  );

  const expectedOutputsTotalPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(expectedOutputRows.length / EXPECTED_OUTPUTS_PAGE_SIZE),
      ),
    [expectedOutputRows.length],
  );

  useEffect(() => {
    if (step === 3) setExpectedOutputsPage(1);
  }, [step]);

  useEffect(() => {
    setExpectedOutputsPage((prev) => Math.min(prev, expectedOutputsTotalPages));
  }, [expectedOutputsTotalPages]);

  const paginatedExpectedOutputRows = useMemo(() => {
    const start = (expectedOutputsPage - 1) * EXPECTED_OUTPUTS_PAGE_SIZE;
    return expectedOutputRows.slice(start, start + EXPECTED_OUTPUTS_PAGE_SIZE);
  }, [expectedOutputsPage, expectedOutputRows]);

  const centerName = useMemo(() => {
    return (
      centers.find((item) => item.id === form.research_center_id)?.name || "-"
    );
  }, [centers, form.research_center_id]);

  const agendaName = useMemo(() => {
    return (
      effectiveAgendas.find((item) => item.id === form.research_agenda_id)
        ?.name || "-"
    );
  }, [effectiveAgendas, form.research_agenda_id]);

  const departmentName = useMemo(() => {
    return (
      departments.find((item) => item.id === form.department_id)?.name || "-"
    );
  }, [departments, form.department_id]);
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
      if (matchedDepartment?.id) {
        return matchedDepartment.id;
      }
    }
    if (!profileDepartment) return "";
    return (
      departments.find(
        (item) =>
          String(item.name || "")
            .trim()
            .toLowerCase() === profileDepartment,
      )?.id || ""
    );
  }, [departments, profile?.ckan_group_id, profile?.department]);
  const leadResearcherSelections = useMemo(
    () => splitCsvNames(form.lead_researcher),
    [form.lead_researcher],
  );
  const facultyTeamSelections = useMemo(
    () => splitCsvNames(form.faculty_team),
    [form.faculty_team],
  );
  const selectedLeadResearcher = leadResearcherSelections[0] || "";
  const ckanUserOptions = useMemo(() => {
    return (ckanUsers || []).map((row, index) => ({
      id: row.id || row.username || row.email || `ckan-user-${index}`,
      name:
        String(
          row.name || row.fullname || row.display_name || row.username || "",
        ).trim() || "CKAN User",
      username: String(row.username || row.name || "").trim(),
      email: String(row.email || "")
        .trim()
        .toLowerCase(),
      role: String(row.role || "")
        .trim()
        .toLowerCase(),
    }));
  }, [ckanUsers]);
  const leadEligibleUserOptions = useMemo(
    () =>
      ckanUserOptions.filter((row) =>
        ["student", "faculty"].includes(String(row.role || "").toLowerCase()),
      ),
    [ckanUserOptions],
  );
  const facultyEligibleUserOptions = useMemo(
    () =>
      ckanUserOptions.filter(
        (row) => String(row.role || "").toLowerCase() === "faculty",
      ),
    [ckanUserOptions],
  );
  const selectedLeadResearcherUser = useMemo(() => {
    const selected = form.lead_researcher_user;
    if (selected && typeof selected === "object") return selected;
    if (!selectedLeadResearcher) return null;
    return (
      leadEligibleUserOptions.find(
        (row) => String(row.name || "").trim() === selectedLeadResearcher,
      ) || null
    );
  }, [
    form.lead_researcher_user,
    leadEligibleUserOptions,
    selectedLeadResearcher,
  ]);
  const selectedFacultyTeamUsers = useMemo(() => {
    const structured = Array.isArray(form.faculty_team_users)
      ? form.faculty_team_users
      : [];
    if (structured.length > 0) return structured;
    return facultyTeamSelections
      .map(
        (name) =>
          facultyEligibleUserOptions.find(
            (row) =>
              String(row.name || "").trim() === String(name || "").trim(),
          ) || { id: "", name, username: "", email: "", role: "faculty" },
      )
      .filter(Boolean);
  }, [
    facultyEligibleUserOptions,
    facultyTeamSelections,
    form.faculty_team_users,
  ]);
  const leadSuggestions = useMemo(() => {
    const keyword = leadSearch.trim().toLowerCase();
    if (!keyword) return [];
    return leadEligibleUserOptions
      .filter((ckanUser) =>
        String(ckanUser.name || "")
          .toLowerCase()
          .includes(keyword),
      )
      .filter((ckanUser) => !leadResearcherSelections.includes(ckanUser.name))
      .slice(0, 8);
  }, [leadSearch, leadEligibleUserOptions, leadResearcherSelections]);
  const facultySuggestions = useMemo(() => {
    const keyword = facultySearch.trim().toLowerCase();
    if (!keyword) return [];
    return facultyEligibleUserOptions
      .filter((ckanUser) =>
        String(ckanUser.name || "")
          .toLowerCase()
          .includes(keyword),
      )
      .filter((ckanUser) => !facultyTeamSelections.includes(ckanUser.name))
      .slice(0, 8);
  }, [facultySearch, facultyEligibleUserOptions, facultyTeamSelections]);

  useEffect(() => {
    if (step > highestUnlockedStep) {
      setStep(highestUnlockedStep);
    }
  }, [step, highestUnlockedStep]);

  useEffect(() => {
    if (leadResearcherSelections.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      lead_researcher: leadResearcherSelections[0],
    }));
  }, [leadResearcherSelections]);

  useEffect(() => {
    if (editId) return;
    if (!defaultDepartmentId) return;
    setForm((prev) => {
      if (prev.department_id) return prev;
      return {
        ...prev,
        department_id: defaultDepartmentId,
      };
    });
  }, [defaultDepartmentId, editId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        leadFieldRef.current &&
        !leadFieldRef.current.contains(event.target)
      ) {
        setLeadDropdownOpen(false);
      }
      if (
        facultyFieldRef.current &&
        !facultyFieldRef.current.contains(event.target)
      ) {
        setFacultyDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const moveStep = (delta) => {
    setError("");
    const validationError =
      delta > 0 ? validateSubmissionStep(form, step, expectedOutputRows) : "";
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep((prev) =>
      clampSubmissionStep(prev + delta, SUBMISSION_STEPS.length - 1),
    );
  };

  const clearDraft = () => {
    if (!draftKey) return;
    localStorage.removeItem(draftKey);
    skipNextAutosaveRef.current = !editId;
    hasDraftExpectedOutputsRef.current = false;
      if (!editId) {
        setForm({
          ...INITIAL_SUBMISSION_FORM,
          research_center_id: profile?.ckan_org_id || "",
          department_id: defaultDepartmentId,
        });
        setExpectedOutputRows([]);
        setStep(0);
      }
    setMoaFile(null);
    setError("");
    setMessage("Draft cleared.");
  };

  const getSubmissionValidationError = () => {
    return (
      validateSubmissionStep(form, 0, expectedOutputRows) ||
      validateSubmissionStep(form, 1, expectedOutputRows) ||
      validateSubmissionStep(form, 2, expectedOutputRows) ||
      validateSubmissionStep(form, 3, expectedOutputRows)
    );
  };

  const handleSubmitAttempt = (e) => {
    e?.preventDefault?.();
    setMessage("");
    setError("");

    const validationError = getSubmissionValidationError();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!user?.id) {
      setError("Your session is no longer valid. Please login again.");
      return;
    }
    if (!isLikelyUrl(form.supporting_mov_link)) {
      setError("Supporting MOV link must be a valid URL.");
      return;
    }

    setShowSubmitConfirm(true);
  };

  const updateProponentMultiSelect = (field, nextItems) => {
    setForm((prev) => {
      return {
        ...prev,
        [field]: toCsvNames(nextItems),
      };
    });
  };

  const addProponentSelection = (field, userOption) => {
    const name = String(userOption?.name || "").trim();
    if (!name) return;
    const current = splitCsvNames(form[field]);
    if (current.includes(name)) return;
    setForm((prev) => ({
      ...prev,
      [field]: toCsvNames([...current, name]),
      faculty_team_users:
        field === "faculty_team"
          ? [
              ...(Array.isArray(prev.faculty_team_users)
                ? prev.faculty_team_users.filter(
                    (item) => String(item?.name || "").trim() !== name,
                  )
                : []),
              {
                id: userOption?.id || "",
                name,
                username: userOption?.username || "",
                email: userOption?.email || "",
                role: userOption?.role || "faculty",
              },
            ]
          : prev.faculty_team_users,
    }));
  };

  const removeProponentSelection = (field, name) => {
    const current = splitCsvNames(form[field]);
    setForm((prev) => ({
      ...prev,
      [field]: toCsvNames(current.filter((item) => item !== name)),
      faculty_team_users:
        field === "faculty_team"
          ? (Array.isArray(prev.faculty_team_users)
              ? prev.faculty_team_users
              : []
            ).filter((item) => String(item?.name || "").trim() !== name)
          : prev.faculty_team_users,
    }));
  };

  const setLeadResearcherSelection = (userOption) => {
    const name = String(userOption?.name || "").trim();
    setForm((prev) => ({
      ...prev,
      lead_researcher: name,
      lead_researcher_user: name
        ? {
            id: userOption?.id || "",
            name,
            username: userOption?.username || "",
            email: userOption?.email || "",
            role: userOption?.role || "",
          }
        : null,
    }));
  };

  const openAddOutputModal = () => {
    setError("");
    setEditingOutputClientId(null);
    setNewOutputDraft(createLocalOutputRow());
    setShowAddOutputModal(true);
  };

  const openEditOutputModal = (row) => {
    if (!row) return;
    setError("");
    setEditingOutputClientId(row.client_id);
    setNewOutputDraft({
      ...createLocalOutputRow(),
      ...row,
      target_count: Math.max(1, Number(row.target_count) || 1),
      file: null,
      file_base64: String(row?.file_base64 || "").trim(),
    });
    setShowAddOutputModal(true);
  };

  const closeAddOutputModal = () => {
    setShowAddOutputModal(false);
    setEditingOutputClientId(null);
    setNewOutputDraft(createLocalOutputRow());
  };

  const saveNewExpectedOutput = async () => {
    const normalizedType = String(newOutputDraft.output_type || "").trim();
    if (!normalizedType) {
      setError("Expected output type is required.");
      return;
    }
    const normalizedTargetCount = Math.max(
      1,
      Number(newOutputDraft.target_count) || 0,
    );
    if (normalizedTargetCount < 1) {
      setError("Target count must be at least 1.");
      return;
    }
    const normalizedSpecificOutput = String(
      newOutputDraft.specific_output || "",
    ).trim();
    if (normalizedType === "product_software" && !normalizedSpecificOutput) {
      setError(
        "Specific output is required for Product/Software Application type.",
      );
      return;
    }
    const selectedFile = newOutputDraft.file;
    const isEditMode = Boolean(editingOutputClientId);
    const existingRow = isEditMode
      ? expectedOutputRows.find(
          (row) => row.client_id === editingOutputClientId,
        )
      : null;
    const existingFilePath = String(
      existingRow?.file_path || newOutputDraft.file_path || "",
    ).trim();
    const existingFileName = String(
      newOutputDraft.file_name || existingRow?.file_name || "",
    ).trim();
    const existingFileBase64 = String(
      newOutputDraft.file_base64 || existingRow?.file_base64 || "",
    ).trim();

    setError("");
    setMessage("");
    if (!selectedFile && existingFileName && !existingFilePath && !existingFileBase64) {
      setError("Please re-attach the output file before saving this entry.");
      return;
    }
    if (selectedFile) {
      if (selectedFile.size > MAX_OUTPUT_FILE_SIZE_BYTES) {
        setError("Each expected output file must be 25MB or smaller.");
        return;
      }
    }
    const nextFileBase64 = selectedFile
      ? await fileToBase64(selectedFile)
      : existingFileBase64;
    const nextRow = {
      ...newOutputDraft,
      output_type: normalizedType,
      target_count: normalizedTargetCount,
      specific_output:
        normalizedType === "product_software" ? normalizedSpecificOutput : "",
      notes: String(newOutputDraft.notes || "").trim(),
      file: selectedFile || null,
      file_path: selectedFile ? "" : existingFilePath,
      file_name: selectedFile ? selectedFile.name || "" : existingFileName,
      mime_type: selectedFile
        ? selectedFile.type || ""
        : String(newOutputDraft.mime_type || existingRow?.mime_type || "").trim(),
      file_size: selectedFile
        ? selectedFile.size || null
        : newOutputDraft.file_size || existingRow?.file_size || null,
      file_base64: nextFileBase64,
      is_saved: true,
    };

    setExpectedOutputRows((prev) => {
      if (!isEditMode) {
        return [...prev, nextRow];
      }
      return prev.map((row) =>
        row.client_id === editingOutputClientId ? nextRow : row,
      );
    });
    closeAddOutputModal();
  };

  const deleteExpectedOutputRow = (clientId) => {
    const target = expectedOutputRows.find((row) => row.client_id === clientId);
    setExpectedOutputRows((prev) =>
      prev.filter((row) => row.client_id !== clientId),
    );
    if (target?.file_path && String(target.file_path).startsWith("draft/")) {
      void removeExpectedOutputFilesFromStorage({
        filePaths: [target.file_path],
      });
    }
  };

  const submit = async () => {
    setSubmitting(true);
    const summaryText = buildExpectedOutputsSummary(expectedOutputRows);
    let moaReference = form.signed_moa_reference || null;
    let uploadedMoaPath = "";
    if (moaFile) {
      const baseProjectRef = editId || "draft";
      const storagePath = `${baseProjectRef}/moa/${Date.now()}-${sanitizeFileName(moaFile.name)}`;
      const { data: uploadedMoa, error: uploadError } =
        await uploadMovFileToStorage({
          storagePath,
          file: moaFile,
          contentType: moaFile.type || "application/octet-stream",
        });
      if (uploadError) {
        setError(
          `Unable to attach MOA file: ${uploadError.message || "Unknown upload error."}`,
        );
        setSubmitting(false);
        return;
      }
      moaReference = uploadedMoa?.path || storagePath;
      uploadedMoaPath = moaReference;
    }

    const expectedOutputsForSave = await Promise.all(
      expectedOutputRows.map(async (row) => {
        const file = row?.file || null;
        if (file) {
          const base64 = await fileToBase64(file);
          return {
            ...row,
            file_base64: base64,
            file_name: file?.name || row.file_name || "",
            mime_type: file?.type || row.mime_type || "",
            file_size: file?.size || row.file_size || null,
            file_path: "",
          };
        }
        if (row?.file_base64) {
          return row;
        }
        return row;
      }),
    );

    const formForSave = {
      ...form,
      expected_outputs: summaryText,
      expected_outputs_items: expectedOutputRows.map((row) => ({
        output_type: row.output_type || "",
        target_count: Math.max(1, Number(row.target_count) || 1),
        specific_output: row.specific_output || "",
      })),
      signed_moa_reference: moaReference,
    };
    const {
      mode,
      data,
      error: saveError,
    } = await saveSubmission({
      userId: user.id,
      editId,
      form: formForSave,
      expectedOutputs: expectedOutputsForSave,
    });

    if (mode === "revise") {
      if (saveError || !data) {
        if (uploadedMoaPath) {
          await removeMovFilesFromStorage({ filePaths: [uploadedMoaPath] });
        }
        setError(saveError?.message || "Unable to save revision.");
        setSubmitting(false);
        return;
      }

      localStorage.removeItem(draftKey);
      skipNextAutosaveRef.current = true;
      setMoaFile(null);
      setMessage(
        moaFile
          ? "Research project revision saved with MOA attachment."
          : "Research project revision saved successfully.",
      );
      setShowSubmitConfirm(false);
      setSubmitting(false);
      navigate("/submit-project");
      return;
    }

    if (saveError) {
      if (uploadedMoaPath) {
        await removeMovFilesFromStorage({ filePaths: [uploadedMoaPath] });
      }
      setError(saveError.message);
      setSubmitting(false);
      return;
    }

    localStorage.removeItem(draftKey);
    skipNextAutosaveRef.current = true;
    setMoaFile(null);
    setMessage(
      moaFile
        ? "Research project submitted with MOA attachment."
        : "Research project submitted successfully.",
    );
    setForm({
      ...INITIAL_SUBMISSION_FORM,
      research_center_id: profile?.ckan_org_id || "",
      department_id: defaultDepartmentId,
    });
    setExpectedOutputRows([]);
    setStep(0);
      setShowSubmitConfirm(false);
      setSubmitting(false);
      navigate("/submit-project");
    };

  const handleSaveDraft = async () => {
    if (!user?.id) return;
    if (editId && submissionState && submissionState !== "draft") {
      setError("Only draft submissions can be saved as a draft.");
      return;
    }
    setSavingDraft(true);
    setMessage("");
    setError("");

    const { data, error: draftError } = await saveDraftSubmission({
      userId: user.id,
      editId,
      form,
      expectedOutputs: expectedOutputRows,
      draftStep: step,
    });

    if (draftError || !data?.id) {
      setError(draftError?.message || "Unable to save draft.");
      setSavingDraft(false);
      return;
    }

    if (draftKey) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }

    setMessage("Draft saved.");
    setSavingDraft(false);

    if (!editId) {
      navigate(`/submit-project/submit?edit=${encodeURIComponent(data.id)}`, {
        replace: true,
      });
    }
  };

  return (
    <section className="page-stack-lg pb-24 lg:pb-0">
      <PageHeader
        title={editId ? "Revise Research Project" : "Submit Research Project"}
        description="Use step-by-step form completion. Your draft is auto-saved in this browser."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/submit-project")}
          >
            Go back
          </Button>
        }
      />

      <div className="rounded-[var(--radius-sm)] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
              Progressive Flow
            </p>
            <p className="text-xs text-slate-500">
              Complete current step to unlock the next stage.
            </p>
          </div>
          <p className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
            {step + 1}/{SUBMISSION_STEPS.length}
          </p>
        </div>

        <div className="relative mt-5">
          <div className="absolute left-0 right-0 top-4 h-1 rounded-full bg-slate-200" />
          <div
            className="absolute left-0 top-4 h-1 rounded-full bg-[linear-gradient(90deg,#0284c7,#10b981)] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
          <div className="relative grid grid-cols-5 gap-2">
            {SUBMISSION_STEPS.map((item) => {
              const locked = !canAccessSubmissionStep(
                form,
                item.id,
                expectedOutputRows,
              );
              const completed = item.id < step && !locked;
              const active = step === item.id;
              const Icon = completed ? CheckCircle2 : active ? CircleDot : Lock;
              const statusText = locked
                ? "Locked"
                : active
                  ? "Current"
                  : completed
                    ? "Done"
                    : "Ready";

              return (
                <button
                  type="button"
                  key={item.id}
                  className="text-left"
                  onClick={() => {
                    if (locked) return;
                    setStep(item.id);
                  }}
                  disabled={locked}
                  title={locked ? "Complete previous steps first." : ""}
                >
                  <div
                    className={`mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-sm ${
                      active
                        ? "border-sky-300 bg-sky-100 text-sky-700"
                        : completed
                          ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                          : locked
                            ? "border-slate-300 bg-slate-100 text-slate-400"
                            : "border-slate-300 bg-white text-slate-600"
                    }`}
                  >
                    <Icon size={14} aria-hidden="true" />
                  </div>
                  <p
                    className={`mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] ${
                      locked
                        ? "text-slate-400"
                        : active
                          ? "text-sky-700"
                          : completed
                            ? "text-emerald-700"
                            : "text-slate-600"
                    }`}
                  >
                    {statusText}
                  </p>
                  <p
                    className={`text-center text-xs font-semibold ${
                      locked ? "text-slate-400" : "text-slate-800"
                    }`}
                  >
                    {item.label}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loadingEdit ? (
        <Card>
          <CardContent className="p-5 text-sm text-slate-600">
            Loading submission for revision...
          </CardContent>
        </Card>
      ) : null}

      <form onSubmit={handleSubmitAttempt}>
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
              {SUBMISSION_STEPS[step].label}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={clearDraft}>
                Clear Draft
              </Button>
            </div>
          </CardHeader>

          <CardContent className="grid w-full gap-6 p-5">
            {step === 0 ? (
              <div className="space-y-5">
                <div className="form-section">
                  <div className="form-section-head">
                    <p className="form-section-title">
                      Basic Project Information
                    </p>
                    <p className="form-section-note">
                      Start with the core project details to establish context.
                    </p>
                  </div>
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Project title
                    </span>
                    <Input
                      placeholder="e.g. AI Mentorship in Public Schools"
                      required
                      value={form.title}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, title: e.target.value }))
                      }
                    />
                    <p className="text-xs text-slate-500">
                      Use a concise, descriptive title that will appear in
                      reports.
                    </p>
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Project abstract/summary
                    </span>
                    <Textarea
                      className="min-h-24"
                      placeholder="Briefly explain objectives, target beneficiaries, and expected outcomes."
                      value={form.abstract}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, abstract: e.target.value }))
                      }
                    />
                  </label>
                </div>

                <div className="form-section">
                  <div className="form-section-head">
                    <p className="form-section-title">Research Team</p>
                  </div>
                  <div className="form-fields-grid form-fields-grid-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Lead researcher
                      </span>
                      <div ref={leadFieldRef} className="relative space-y-2">
                        <Input
                          placeholder="Type a Lead Researcher name"
                          value={leadSearch}
                          onFocus={() =>
                            setLeadDropdownOpen(Boolean(leadSearch.trim()))
                          }
                          onChange={(e) => {
                            setLeadSearch(e.target.value);
                            setLeadDropdownOpen(Boolean(e.target.value.trim()));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && leadSuggestions[0]) {
                              e.preventDefault();
                              setLeadResearcherSelection(leadSuggestions[0]);
                              setLeadSearch("");
                              setLeadDropdownOpen(false);
                            }
                          }}
                        />
                        {leadDropdownOpen && leadSuggestions.length > 0 ? (
                          <div className="absolute z-10 max-h-56 w-full overflow-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-1 shadow-sm">
                            {leadSuggestions.map((ckanUser) => (
                              <button
                                key={`lead-option-${ckanUser.id}`}
                                type="button"
                                className="w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-[var(--surface-muted)]"
                                onClick={() => {
                                  setLeadResearcherSelection(ckanUser);
                                  setLeadSearch("");
                                  setLeadDropdownOpen(false);
                                }}
                              >
                                {ckanUser.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <Card className="bg-muted/30 shadow-none">
                        <CardContent className="p-3">
                          {!selectedLeadResearcher ? (
                            <p className="text-xs text-slate-500">
                              No Lead Researcher selected yet.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              <span
                                key={`lead-chip-${selectedLeadResearcher}`}
                                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]"
                              >
                                {selectedLeadResearcher}
                                <button
                                  type="button"
                                  className="text-[var(--brand)] hover:text-[var(--brand-strong)]"
                                  onClick={() =>
                                    setLeadResearcherSelection(null)
                                  }
                                  aria-label={`Remove ${selectedLeadResearcher}`}
                                >
                                  x
                                </button>
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      <p className="text-xs text-slate-500">
                        Type to search and select one Lead Researcher only.
                      </p>
                    </label>
                    <label className="block space-y-1 text-sm lg:col-span-1">
                      <span className="font-semibold text-slate-700">
                        Research team (faculty)
                      </span>
                      <div ref={facultyFieldRef} className="relative space-y-2">
                        <Input
                          placeholder="Type a Faculty name"
                          value={facultySearch}
                          onFocus={() =>
                            setFacultyDropdownOpen(
                              Boolean(facultySearch.trim()),
                            )
                          }
                          onChange={(e) => {
                            setFacultySearch(e.target.value);
                            setFacultyDropdownOpen(
                              Boolean(e.target.value.trim()),
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && facultySuggestions[0]) {
                              e.preventDefault();
                              addProponentSelection(
                                "faculty_team",
                                facultySuggestions[0],
                              );
                              setFacultySearch("");
                              setFacultyDropdownOpen(false);
                            }
                          }}
                        />
                        {facultyDropdownOpen &&
                        facultySuggestions.length > 0 ? (
                          <div className="absolute z-10 max-h-56 w-full overflow-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-1 shadow-sm">
                            {facultySuggestions.map((ckanUser) => (
                              <button
                                key={`faculty-option-${ckanUser.id}`}
                                type="button"
                                className="w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-[var(--surface-muted)]"
                                onClick={() => {
                                  addProponentSelection(
                                    "faculty_team",
                                    ckanUser,
                                  );
                                  setFacultySearch("");
                                  setFacultyDropdownOpen(false);
                                }}
                              >
                                {ckanUser.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <Card className="bg-muted/30 shadow-none">
                        <CardContent className="p-3">
                          {facultyTeamSelections.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              No Faculty selected yet.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {facultyTeamSelections.map((name) => (
                                <span
                                  key={`faculty-chip-${name}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]"
                                >
                                  {name}
                                  <button
                                    type="button"
                                    className="text-[var(--brand)] hover:text-[var(--brand-strong)]"
                                    onClick={() =>
                                      removeProponentSelection(
                                        "faculty_team",
                                        name,
                                      )
                                    }
                                    aria-label={`Remove ${name}`}
                                  >
                                    x
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      <p className="text-xs text-slate-500">
                        Type to search and select one or more Faculty.
                      </p>
                    </label>
                  </div>
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Research team (students)
                    </span>
                    <Input
                      placeholder="Comma-separated names (optional)"
                      value={form.student_team}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          student_team: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="form-section">
                  <div className="form-section-head">
                    <p className="form-section-title">Project Context</p>
                  </div>
                  <div className="form-fields-grid form-fields-grid-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Project year
                      </span>
                      <Input
                        type="number"
                        min="2000"
                        max="2100"
                        inputMode="numeric"
                        placeholder="e.g. 2026"
                        required
                        value={form.year}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            year: sanitizeDigits(e.target.value, 4),
                          }))
                        }
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Research center
                      </span>
                      <Input
                        value={
                          centerName === "-"
                            ? form.research_center_id ||
                              profile?.ckan_org_id ||
                              ""
                            : centerName
                        }
                        readOnly
                        disabled
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="form-section">
                <div className="form-section-head">
                  <p className="form-section-title">Classification Details</p>
                  <p className="form-section-note">
                    Classify the project for reporting, routing, and review.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Project classification
                    </span>
                    <Select
                      value={form.classification || "academic"}
                      onValueChange={(value) =>
                        setForm((p) => ({ ...p, classification: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select classification" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="industry">Industry</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">Status</span>
                    <Select
                      value={form.status || "proposal"}
                      onValueChange={(value) =>
                        setForm((p) => ({ ...p, status: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="ongoing">On-going</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Research agenda
                    </span>
                    <Select
                      value={form.research_agenda_id || "__none__"}
                      disabled={effectiveAgendas.length === 0}
                      onValueChange={(value) =>
                        setForm((p) => ({
                          ...p,
                          research_agenda_id: value === "__none__" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select research agenda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          Select research agenda
                        </SelectItem>
                        {effectiveAgendas.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {effectiveAgendas.length === 0 ? (
                      <p className="text-xs text-amber-700">
                        No research agenda found in your organization custom
                        fields.
                      </p>
                    ) : null}
                  </label>

                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Department
                    </span>
                    <Input
                      value={departmentName === "-" ? "" : departmentName}
                      readOnly
                      disabled
                    />
                  </label>
                  <label className="block space-y-1 text-sm sm:col-span-2">
                    <span className="font-semibold text-slate-700">
                      Scholarly type
                    </span>
                    <Input
                      placeholder="e.g. Industry-based, Other Scholarly"
                      value={form.scholarly_type}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          scholarly_type: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div className="form-section">
                  <div className="form-section-head">
                    <p className="form-section-title">Funding Details</p>
                    <p className="form-section-note">
                      Enter funding values and source details as accurately as
                      possible.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Funding type
                      </span>
                      <Select
                        value={form.funding_type || "none"}
                        onValueChange={(value) =>
                          setForm((p) => ({ ...p, funding_type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select funding type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="internal">Internal</SelectItem>
                          <SelectItem value="external">External</SelectItem>
                          <SelectItem value="self_funded">
                            Self Funded
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Funding category
                      </span>
                      <Input
                        placeholder="e.g. External (Industry-Sponsored)"
                        value={form.funding_category}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            funding_category: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Funding source
                      </span>
                      <Input
                        placeholder="e.g. ARMS Grants Office"
                        value={form.funding_source}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            funding_source: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Funding amount
                      </span>
                      <Input
                        placeholder="e.g. 50000"
                        type="number"
                        min="0"
                        inputMode="decimal"
                        step="0.01"
                        value={form.funding_amount}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            funding_amount: sanitizeDecimal(e.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <div className="form-section-head">
                    <p className="form-section-title">MOA and Timeline</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Industry/Agency partner
                      </span>
                      <Input
                        placeholder="e.g. PNP, DA-BAFE"
                        value={form.industry_partner}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            industry_partner: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Signed MOA reference
                      </span>
                      <div className="upload-field">
                        <div className="upload-picker">
                          <div className="upload-picker-info">
                            <FileText
                              size={16}
                              className="mt-0.5 text-slate-500"
                              aria-hidden="true"
                            />
                            <div className="space-y-0.5">
                              <p className="upload-picker-name">
                                {moaFile?.name || "No file selected"}
                              </p>
                              <p className="upload-picker-sub">
                                Size: {formatFileSize(moaFile?.size)}
                              </p>
                            </div>
                          </div>
                          <Button
                            asChild
                            variant="outline"
                            className="upload-trigger"
                          >
                            <label>
                              <Upload size={14} aria-hidden="true" />
                              <span>{moaFile ? "Replace" : "Choose File"}</span>
                              <input
                                className="sr-only"
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                onChange={(e) => {
                                  const nextFile = e.target.files?.[0] || null;
                                  if (!nextFile) {
                                    setMoaFile(null);
                                    return;
                                  }
                                  if (nextFile.size > MAX_MOA_FILE_SIZE_BYTES) {
                                    setError(
                                      "MOA file must be 25MB or smaller.",
                                    );
                                    e.target.value = "";
                                    return;
                                  }
                                  setError("");
                                  setMoaFile(nextFile);
                                }}
                              />
                            </label>
                          </Button>
                        </div>
                        <div className="upload-field-preview">
                          <p className="upload-field-preview-text">
                            Current reference:{" "}
                            {form.signed_moa_reference || "-"}
                          </p>
                          <p className="upload-field-hint">
                            Allowed: PDF, DOC, XLS, PNG, JPG | Max 25MB
                          </p>
                          <p className="text-xs text-slate-600">
                            Upload is saved when you submit/save revision.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Start date
                      </span>
                      <Input
                        type="date"
                        value={form.start_date}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            start_date: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        End date (due date)
                      </span>
                      <Input
                        type="date"
                        value={form.end_date}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            end_date: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <Card className="bg-muted/30 shadow-none">
                  <CardContent className="p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">
                      Submission checklist
                    </p>
                    <ul className="mt-1 list-disc pl-4">
                      <li>Title and center are filled.</li>
                      <li>Classification and year are valid.</li>
                      <li>
                        Dates and funding values are logically consistent.
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <div className="form-section">
                  <div className="form-section-head">
                    <p className="form-section-title">Outputs and Resources</p>
                    <p className="form-section-note">
                      Optional step: add outputs now, or add them later in
                      Research Outputs.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">
                        Expected research outputs
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openAddOutputModal}
                      >
                        Add Output
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Rows are finalized in database when you submit/save
                      revision.
                    </p>
                    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white">
                      <Table className="min-w-[680px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Output Type</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead>File</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expectedOutputRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="px-3 py-4 text-center text-xs text-slate-500"
                              >
                                No expected outputs added yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedExpectedOutputRows.map((row) => (
                              <TableRow key={row.client_id}>
                                <TableCell>
                                  {EXPECTED_OUTPUT_TYPE_OPTIONS.find(
                                    (item) => item.value === row.output_type,
                                  )?.label ||
                                    row.output_type ||
                                    "-"}
                                  {String(row.specific_output || "").trim() ? (
                                    <p className="text-xs text-slate-500">
                                      Specific: {row.specific_output}
                                    </p>
                                  ) : null}
                                </TableCell>
                                <TableCell className="text-slate-600">
                                  {Math.max(1, Number(row.target_count) || 1)}
                                </TableCell>
                                <TableCell className="text-slate-600">
                                  {row.notes || "-"}
                                  {row.needs_file_reselect ? (
                                    <p className="text-xs text-amber-700">
                                      File needs re-attach after refresh.
                                    </p>
                                  ) : null}
                                </TableCell>
                                <TableCell className="break-all text-slate-600">
                                  {row.file_name ||
                                    row.file?.name ||
                                    row.file_path ||
                                    "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => openEditOutputModal(row)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="border-destructive text-destructive hover:bg-destructive/10"
                                      onClick={() =>
                                        deleteExpectedOutputRow(row.client_id)
                                      }
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {expectedOutputRows.length > 0 ? (
                      <PaginationControls
                        page={expectedOutputsPage}
                        totalPages={expectedOutputsTotalPages}
                        onPageChange={setExpectedOutputsPage}
                      />
                    ) : null}
                  </div>
                  <label className="block space-y-1 text-sm sm:max-w-2xl">
                    <span className="font-semibold text-slate-700">
                      Supporting MOV link (optional)
                    </span>
                    <Input
                      placeholder="Google Drive link or repository of supporting MOVs"
                      value={form.supporting_mov_link}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          supporting_mov_link: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3 text-sm sm:max-w-2xl">
                    <input
                      className="mt-1 h-4 w-4"
                      type="checkbox"
                      checked={Boolean(form.public_visible)}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          public_visible: e.target.checked,
                        }))
                      }
                    />
                    <span className="space-y-1">
                      <span className="block font-semibold text-slate-700">
                        Make project publicly visible after submission
                      </span>
                      <span className="block text-xs text-slate-500">
                        Turn this on if the dataset can be visible outside your
                        private workspace.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--brand-soft)] p-3 text-sm text-[var(--brand-strong)]">
                  <p className="font-semibold">Final Review</p>
                  <p className="mt-1">
                    Review the form details below. If something is incorrect, go
                    back and edit before final submission.
                  </p>
                </div>

                <div className="grid gap-4">
                  <Card>
                    <CardContent className="p-5">
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                        Step 1: Project
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-sm sm:col-span-2">
                          <span className="font-semibold text-slate-700">
                            Project Title
                          </span>
                          <Input value={form.title || "-"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Lead Researcher
                          </span>
                          <Input value={form.lead_researcher || "-"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Project Year
                          </span>
                          <Input value={form.year || "-"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm sm:col-span-2">
                          <span className="font-semibold text-slate-700">
                            Research Center
                          </span>
                          <Input value={centerName} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Faculty Team
                          </span>
                          <Textarea
                            className="min-h-20"
                            value={form.faculty_team || "-"}
                            readOnly
                          />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Student Team
                          </span>
                          <Textarea
                            className="min-h-20"
                            value={form.student_team || "-"}
                            readOnly
                          />
                        </label>
                        <label className="space-y-1 text-sm sm:col-span-2">
                          <span className="font-semibold text-slate-700">
                            Abstract
                          </span>
                          <Textarea
                            className="min-h-24"
                            value={form.abstract || "-"}
                            readOnly
                          />
                        </label>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                        Step 2: Classification
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Status
                          </span>
                          <Input value={form.status || "-"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Classification
                          </span>
                          <Input value={form.classification || "-"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Scholarly Type
                          </span>
                          <Input value={form.scholarly_type || "-"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Research Agenda
                          </span>
                          <Input value={agendaName} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Department
                          </span>
                          <Input value={departmentName} readOnly />
                        </label>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                        Step 3: Funding & Timeline
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Funding Type
                          </span>
                          <Input value={form.funding_type || "-"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Funding Category
                          </span>
                          <Input
                            value={form.funding_category || "-"}
                            readOnly
                          />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Funding Source
                          </span>
                          <Input value={form.funding_source || "-"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Funding Amount
                          </span>
                          <Input value={form.funding_amount || "0"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Industry/Agency Partner
                          </span>
                          <Input
                            value={form.industry_partner || "-"}
                            readOnly
                          />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Signed MOA Reference
                          </span>
                          <Input
                            value={
                              moaFile?.name || form.signed_moa_reference || "-"
                            }
                            readOnly
                          />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            Start Date
                          </span>
                          <Input value={form.start_date || "-"} readOnly />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-semibold text-slate-700">
                            End Date
                          </span>
                          <Input value={form.end_date || "-"} readOnly />
                        </label>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-5">
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                        Step 4: Outputs & Visibility
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-sm sm:col-span-2">
                          <span className="font-semibold text-slate-700">
                            Expected Outputs
                          </span>
                          <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3">
                            {expectedOutputRows.length === 0 ? (
                              <p className="text-sm text-slate-600">-</p>
                            ) : (
                              expectedOutputRows.map((row) => (
                                <Card
                                  key={`review-output-${row.client_id}`}
                                  className="shadow-none"
                                >
                                  <CardContent className="p-3 text-sm">
                                    <p className="font-semibold text-slate-800">
                                      {EXPECTED_OUTPUT_TYPE_OPTIONS.find(
                                        (item) =>
                                          item.value === row.output_type,
                                      )?.label ||
                                        row.output_type ||
                                        "-"}
                                    </p>
                                    {String(
                                      row.specific_output || "",
                                    ).trim() ? (
                                      <p className="text-slate-600">
                                        Specific: {row.specific_output}
                                      </p>
                                    ) : null}
                                    <p className="text-slate-600">
                                      Target:{" "}
                                      {Math.max(
                                        1,
                                        Number(row.target_count) || 1,
                                      )}{" "}
                                      | Notes: {row.notes || "-"}
                                    </p>
                                    <p className="text-slate-600 break-all">
                                      File:{" "}
                                      {row.file?.name ||
                                        row.file_name ||
                                        row.file_path ||
                                        "-"}
                                    </p>
                                  </CardContent>
                                </Card>
                              ))
                            )}
                          </div>
                        </label>
                        <label className="space-y-1 text-sm sm:col-span-2">
                          <span className="font-semibold text-slate-700">
                            Supporting MOV Link
                          </span>
                          <Input
                            value={form.supporting_mov_link || "-"}
                            readOnly
                          />
                        </label>
                        <label className="space-y-1 text-sm sm:col-span-2">
                          <span className="font-semibold text-slate-700">
                            Visibility
                          </span>
                          <Input
                            value={
                              form.public_visible
                                ? "Publicly visible"
                                : "Private"
                            }
                            readOnly
                          />
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(disabledOutlineButtonClass)}
                  onClick={() => moveStep(-1)}
                >
                  Previous
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                {!editId || submissionState === "draft" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || submitting || loadingEdit}
                  >
                    {savingDraft ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Save Draft
                      </span>
                    )}
                  </Button>
                ) : null}
                {step < SUBMISSION_STEPS.length - 1 ? (
                  <Button
                    type="button"
                    className={cn(disabledButtonClass)}
                    onClick={(event) => {
                      event.preventDefault();
                      moveStep(1);
                    }}
                    disabled={Boolean(
                      validateSubmissionStep(form, step, expectedOutputRows),
                    )}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className={cn(disabledButtonClass)}
                    disabled={Boolean(getSubmissionValidationError())}
                  >
                    {editId ? "Save Revision" : "Submit Research Project"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      <div className="fixed bottom-3 left-3 right-3 z-20 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/95 p-2 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              className={cn(disabledOutlineButtonClass)}
              onClick={() => moveStep(-1)}
            >
              Prev
            </Button>
          ) : (
            <span />
          )}
          {!editId || submissionState === "draft" ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft || submitting || loadingEdit}
            >
              {savingDraft ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </Button>
          ) : null}
          {step < SUBMISSION_STEPS.length - 1 ? (
            <Button
              type="button"
              className={cn(disabledButtonClass)}
              onClick={(event) => {
                event.preventDefault();
                moveStep(1);
              }}
              disabled={Boolean(
                validateSubmissionStep(form, step, expectedOutputRows),
              )}
            >
              Next Step
            </Button>
          ) : (
            <Button
              type="button"
              className={cn(disabledButtonClass)}
              onClick={handleSubmitAttempt}
              disabled={Boolean(getSubmissionValidationError())}
            >
              {editId ? "Save" : "Submit Project"}
            </Button>
          )}
        </div>
      </div>

      <ConfirmActionModal
        open={showSubmitConfirm}
        align="center"
        title="Confirm Submission"
        message={`You are about to ${editId ? "save this revision" : "submit this research project"}. Please confirm that all Step 1 to Step 4 information is correct.`}
        confirmLabel={editId ? "Confirm Save" : "Confirm Submit"}
        loading={submitting}
        onCancel={() => setShowSubmitConfirm(false)}
        onConfirm={submit}
      />

      <Dialog
        open={showAddOutputModal}
        onOpenChange={(open) => {
          if (!open) closeAddOutputModal();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingOutputClientId ? "Edit Output" : "Add Output"}
            </DialogTitle>
            <DialogDescription>
              Fill out the output details, then click{" "}
              {editingOutputClientId ? "Save" : "Add"} to list it in Step 4.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Output type</span>
              <Select
                value={newOutputDraft.output_type || "__none__"}
                onValueChange={(value) =>
                  setNewOutputDraft((prev) => ({
                    ...prev,
                    output_type: value === "__none__" ? "" : value,
                    specific_output:
                      value === "product_software"
                        ? prev.specific_output || ""
                        : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select output type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select output type</SelectItem>
                  {EXPECTED_OUTPUT_TYPE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {newOutputDraft.output_type === "product_software" ? (
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Specific output
                </span>
                <Select
                  value={newOutputDraft.specific_output || "__none__"}
                  onValueChange={(value) =>
                    setNewOutputDraft((prev) => ({
                      ...prev,
                      specific_output: value === "__none__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select specific output" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      Select specific output
                    </SelectItem>
                    {PRODUCT_SOFTWARE_SPECIFIC_OUTPUT_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}

            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Target count</span>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={newOutputDraft.target_count}
                onChange={(e) =>
                  setNewOutputDraft((prev) => ({
                    ...prev,
                    target_count: sanitizeDigits(e.target.value, 3),
                  }))
                }
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Notes</span>
              <Input
                placeholder="Short note about this expected output"
                value={newOutputDraft.notes || ""}
                onChange={(e) =>
                  setNewOutputDraft((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </label>

            <div className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">
                Output file (optional)
              </span>
              <div className="upload-field">
                <div className="upload-picker">
                  <div className="upload-picker-info">
                    <FileText
                      size={16}
                      className="mt-0.5 text-slate-500"
                      aria-hidden="true"
                    />
                    <div className="space-y-0.5">
                      <p className="upload-picker-name">
                        {newOutputDraft.file?.name ||
                          newOutputDraft.file_name ||
                          "No file selected"}
                      </p>
                      <p className="upload-picker-sub">
                        Size:{" "}
                        {formatFileSize(
                          newOutputDraft.file?.size || newOutputDraft.file_size,
                        )}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="upload-trigger">
                    <label>
                      <Upload size={14} aria-hidden="true" />
                      <span>
                        {newOutputDraft.file ? "Replace" : "Choose File"}
                      </span>
                        <input
                          className="sr-only"
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                          onChange={async (e) => {
                            const selectedFile = e.target.files?.[0] || null;
                            if (
                              selectedFile &&
                              selectedFile.size > MAX_OUTPUT_FILE_SIZE_BYTES
                            ) {
                              setError(
                                "Each expected output file must be 25MB or smaller.",
                              );
                              e.target.value = "";
                              return;
                            }
                            setError("");
                            const base64 = selectedFile
                              ? await fileToBase64(selectedFile)
                              : "";
                            setNewOutputDraft((prev) => ({
                              ...prev,
                              file: selectedFile,
                              file_name: selectedFile?.name || "",
                              mime_type: selectedFile?.type || "",
                              file_size: selectedFile?.size || null,
                              file_base64: base64,
                              file_path: "",
                              needs_file_reselect: false,
                            }));
                          }}
                      />
                    </label>
                  </Button>
                </div>
                <div className="upload-field-preview">
                  <p className="upload-field-hint">
                    Allowed: PDF, DOC, XLS, PNG, JPG | Max 25MB
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeAddOutputModal}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveNewExpectedOutput}>
              {editingOutputClientId ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
