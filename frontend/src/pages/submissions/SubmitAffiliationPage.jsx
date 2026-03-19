import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleDot, FileText, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { useReferenceData } from "@/hooks/useReferenceData";
import { isLikelyUrl } from "@/utils/validation";
import {
  fetchEditableSubmission,
  fetchProjectExpectedOutputs,
  removeExpectedOutputFilesFromStorage,
  saveDraftSubmission,
  saveSubmission,
} from "@/services/submissions";
import {
  removeMovFilesFromStorage,
  uploadMovFileToStorage,
} from "@/services/submissions";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import {
  canAccessSubmissionStep,
  clampSubmissionStep,
  getHighestUnlockedSubmissionStep,
  EXPECTED_OUTPUT_TYPE_OPTIONS,
  getSubmissionDraftKey,
  INITIAL_SUBMISSION_FORM,
  mapProjectToSubmissionForm,
  mapDbOutputToLocalRow,
  sanitizeFileName,
  splitCsvNames,
  SUBMISSION_STEPS,
  toCsvNames,
  createLocalOutputRow,
  buildExpectedOutputsSummary,
  validateSubmissionFields,
  validateSubmissionStep,
} from "@/utils/submissions";
import PageHeader from "@/components/layout/PageHeader";
import { useToast } from "@/components/providers/ToastProvider";
import useSubmissionDraft from "@/hooks/submissions/useSubmissionDraft";
import useSubmissionOptions from "@/hooks/submissions/useSubmissionOptions";
import StepProjectInfo from "@/components/submissions/StepProjectInfo";
import StepClassification from "@/components/submissions/StepClassification";
import StepFundingTimeline from "@/components/submissions/StepFundingTimeline";
import StepOutputs from "@/components/submissions/StepOutputs";
import StepReview from "@/components/submissions/StepReview";
import ExpectedOutputModal from "@/components/submissions/ExpectedOutputModal";

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
  const [form, dispatchForm] = useReducer((state, action) => {
    switch (action.type) {
      case "set":
        return action.value;
      case "merge":
        return { ...state, ...action.value };
      case "update":
        return action.updater(state);
      default:
        return state;
    }
  }, INITIAL_SUBMISSION_FORM);
  const setForm = useCallback((valueOrUpdater) => {
    if (typeof valueOrUpdater === "function") {
      dispatchForm({ type: "update", updater: valueOrUpdater });
      return;
    }
    dispatchForm({ type: "set", value: valueOrUpdater });
  }, []);
  const mergeForm = useCallback(
    (value) => {
      dispatchForm({ type: "merge", value });
    },
    [dispatchForm],
  );
  const setField = useCallback(
    (field, value) => {
      dispatchForm({
        type: "update",
        updater: (prev) => ({ ...prev, [field]: value }),
      });
    },
    [dispatchForm],
  );
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
  const stepErrors = useMemo(
    () => validateSubmissionFields(form, step, expectedOutputRows),
    [expectedOutputRows, form, step],
  );
  const { effectiveAgendas, ckanUsers } = useSubmissionOptions({
    orgId: profile?.ckan_org_id || "",
    userId: user?.id,
  });

  useSubmissionDraft({
    editId,
    draftKey,
    step,
    form,
    expectedOutputRows,
    setForm,
    setStep,
    setExpectedOutputRows,
    draftHydrated,
    setDraftHydrated,
    skipNextAutosaveRef,
    hasDraftExpectedOutputsRef,
  });

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
          String(data?.submission_state || "submitted")
            .trim()
            .toLowerCase(),
        );
        setForm(mapProjectToSubmissionForm(data));
        if (
          String(data?.submission_state || "")
            .trim()
            .toLowerCase() === "draft" &&
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
    if (!form.research_agenda_id) return;
    const stillExists = effectiveAgendas.some(
      (item) =>
        String(item?.id || "") === String(form.research_agenda_id || ""),
    );
    if (stillExists) return;
    setField("research_agenda_id", "");
  }, [effectiveAgendas, form.research_agenda_id, setField]);

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

  const reorderExpectedOutputs = (fromIndex, toIndex) => {
    setExpectedOutputRows((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

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
    setField("lead_researcher", leadResearcherSelections[0]);
  }, [leadResearcherSelections, setField]);

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
    setField(field, toCsvNames(nextItems));
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
    mergeForm({
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
    });
  };

  const openAddOutputModal = (outputType = "") => {
    setError("");
    setEditingOutputClientId(null);
    setNewOutputDraft((prev) => ({
      ...createLocalOutputRow(),
      output_type: outputType || prev?.output_type || "",
      specific_output:
        outputType === "product_software" ? prev?.specific_output || "" : "",
    }));
    setShowAddOutputModal(true);
  };

  const openEditOutputModal = (row) => {
    if (!row) return;
    setError("");
    setEditingOutputClientId(row.client_id);
    setNewOutputDraft({
      ...createLocalOutputRow(),
      ...row,
      target_count: 1,
      output_link:
        String(row?.output_link || "").trim() ||
        (isLikelyUrl(row?.file_path) ? row.file_path : ""),
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
    const normalizedTargetCount = 1;
    const normalizedSpecificOutput = String(
      newOutputDraft.specific_output || "",
    ).trim();
    if (normalizedType === "product_software" && !normalizedSpecificOutput) {
      setError(
        "Specific output is required for Product/Software Application type.",
      );
      return;
    }
    const outputLinkRaw = String(newOutputDraft.output_link || "").trim();
    const normalizedOutputLink =
      outputLinkRaw && !/^https?:\/\//i.test(outputLinkRaw)
        ? `https://${outputLinkRaw}`
        : outputLinkRaw;
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
    const existingFilePathIsLink = isLikelyUrl(existingFilePath);

    setError("");
    setMessage("");
    if (
      !selectedFile &&
      existingFileName &&
      !existingFilePath &&
      !existingFileBase64 &&
      !normalizedOutputLink
    ) {
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
    const nextFilePath = selectedFile
      ? ""
      : normalizedOutputLink
        ? normalizedOutputLink
        : existingFilePathIsLink
          ? ""
          : existingFilePath;
    const nextFileName = selectedFile
      ? selectedFile.name || ""
      : normalizedOutputLink
        ? ""
        : existingFileName;
    const nextMimeType = selectedFile
      ? selectedFile.type || ""
      : normalizedOutputLink
        ? ""
        : String(newOutputDraft.mime_type || existingRow?.mime_type || "").trim();
    const nextFileSize = selectedFile
      ? selectedFile.size || null
      : normalizedOutputLink
        ? null
        : newOutputDraft.file_size || existingRow?.file_size || null;
    const nextRow = {
      ...newOutputDraft,
      output_type: normalizedType,
      target_count: normalizedTargetCount,
      specific_output:
        normalizedType === "product_software" ? normalizedSpecificOutput : "",
      output_link: normalizedOutputLink,
      notes: String(newOutputDraft.notes || "").trim(),
      file: selectedFile || null,
      file_path: nextFilePath,
      file_name: nextFileName,
      mime_type: nextMimeType,
      file_size: nextFileSize,
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
        target_count: 1,
        specific_output: row.specific_output || "",
        output_link: row.output_link || "",
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
              <StepProjectInfo
                form={form}
                setField={setField}
                errors={stepErrors}
                leadSearch={leadSearch}
                setLeadSearch={setLeadSearch}
                leadDropdownOpen={leadDropdownOpen}
                setLeadDropdownOpen={setLeadDropdownOpen}
                leadSuggestions={leadSuggestions}
                setLeadResearcherSelection={setLeadResearcherSelection}
                selectedLeadResearcher={selectedLeadResearcher}
                leadFieldRef={leadFieldRef}
                facultySearch={facultySearch}
                setFacultySearch={setFacultySearch}
                facultyDropdownOpen={facultyDropdownOpen}
                setFacultyDropdownOpen={setFacultyDropdownOpen}
                facultySuggestions={facultySuggestions}
                addProponentSelection={addProponentSelection}
                facultyTeamSelections={facultyTeamSelections}
                removeProponentSelection={removeProponentSelection}
                facultyFieldRef={facultyFieldRef}
                sanitizeDigits={sanitizeDigits}
                centerName={centerName}
                profileOrgId={profile?.ckan_org_id || ""}
              />
            ) : null}

            {step === 1 ? (
              <StepClassification
                form={form}
                setField={setField}
                errors={stepErrors}
                effectiveAgendas={effectiveAgendas}
                departmentName={departmentName}
              />
            ) : null}

            {step === 2 ? (
              <StepFundingTimeline
                form={form}
                setField={setField}
                errors={stepErrors}
                sanitizeDecimal={sanitizeDecimal}
                moaFile={moaFile}
                setMoaFile={setMoaFile}
                setError={setError}
                formatFileSize={formatFileSize}
                maxMoaFileSizeBytes={MAX_MOA_FILE_SIZE_BYTES}
              />
            ) : null}

            {step === 3 ? (
              <StepOutputs
                expectedOutputRows={expectedOutputRows}
                paginatedExpectedOutputRows={paginatedExpectedOutputRows}
                expectedOutputsPage={expectedOutputsPage}
                expectedOutputsTotalPages={expectedOutputsTotalPages}
                setExpectedOutputsPage={setExpectedOutputsPage}
                expectedOutputsPageSize={EXPECTED_OUTPUTS_PAGE_SIZE}
                onReorderExpectedOutputs={reorderExpectedOutputs}
                onQuickAddOutput={openAddOutputModal}
                openAddOutputModal={openAddOutputModal}
                openEditOutputModal={openEditOutputModal}
                deleteExpectedOutputRow={deleteExpectedOutputRow}
                form={form}
                setField={setField}
                errors={stepErrors}
              />
            ) : null}

            {step === 4 ? (
              <StepReview
                form={form}
                centerName={centerName}
                agendaName={agendaName}
                departmentName={departmentName}
                expectedOutputRows={expectedOutputRows}
                moaFile={moaFile}
              />
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

      <ExpectedOutputModal
        open={showAddOutputModal}
        onOpenChange={(open) => {
          if (!open) closeAddOutputModal();
        }}
        editingOutputClientId={editingOutputClientId}
        newOutputDraft={newOutputDraft}
        setNewOutputDraft={setNewOutputDraft}
        saveNewExpectedOutput={saveNewExpectedOutput}
        closeAddOutputModal={closeAddOutputModal}
        formatFileSize={formatFileSize}
        fileToBase64={fileToBase64}
        maxOutputFileSizeBytes={MAX_OUTPUT_FILE_SIZE_BYTES}
        productSoftwareSpecificOutputOptions={
          PRODUCT_SOFTWARE_SPECIFIC_OUTPUT_OPTIONS
        }
        setError={setError}
      />
    </section>
  );
}
