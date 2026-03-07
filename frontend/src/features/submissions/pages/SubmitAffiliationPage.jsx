import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleDot, FileText, Lock, Upload } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import {
  fetchCkanOrganizationAgendas,
  fetchCkanUsers,
} from "@/shared/api/ckanApi";
import { isLikelyUrl } from "@/shared/utils/validation";
import {
  fetchEditableSubmission,
  fetchProjectExpectedOutputs,
  insertProjectExpectedOutput,
  updateProjectExpectedOutputFile,
  deleteProjectExpectedOutputs,
  uploadExpectedOutputFileToStorage,
  copyExpectedOutputFileInStorage,
  removeExpectedOutputFilesFromStorage,
  saveSubmission,
} from "@/features/submissions/services";
import { uploadMovFileToStorage } from "@/features/submissions/services";
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

  const formatFileSize = (bytes) => {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return "-";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
        setForm(mapProjectToSubmissionForm(data));

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
          file: null,
          needs_file_reselect: Boolean(
            !row.file_path && row.needs_file_reselect,
          ),
        })),
      );
    } else {
      hasDraftExpectedOutputsRef.current = false;
    }
    setDraftHydrated(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    if (!draftHydrated) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
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
          notes: row.notes,
          file_path: row.file_path,
          file_name: row.file_name,
          mime_type: row.mime_type,
          file_size: row.file_size,
          is_saved: row.is_saved,
          needs_file_reselect: Boolean(
            !row.file_path && !row.file_name && Boolean(row.file),
          ),
        })),
        savedAt: new Date().toISOString(),
      }),
    );
  }, [draftKey, step, form, draftHydrated, expectedOutputRows]);

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
    const orgId = String(profile?.ckan_org_id || "").trim();
    fetchCkanUsers({ orgId })
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
  }, [profile?.ckan_org_id]);

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
    const profileDepartment = String(profile?.department || "")
      .trim()
      .toLowerCase();
    if (!profileDepartment) return "";
    return (
      departments.find(
        (item) =>
          String(item.name || "")
            .trim()
            .toLowerCase() === profileDepartment,
      )?.id || ""
    );
  }, [departments, profile?.department]);
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
    }));
  }, [ckanUsers]);
  const leadSuggestions = useMemo(() => {
    const keyword = leadSearch.trim().toLowerCase();
    if (!keyword) return [];
    return ckanUserOptions
      .filter((ckanUser) =>
        String(ckanUser.name || "")
          .toLowerCase()
          .includes(keyword),
      )
      .filter((ckanUser) => !leadResearcherSelections.includes(ckanUser.name))
      .slice(0, 8);
  }, [leadSearch, ckanUserOptions, leadResearcherSelections]);
  const facultySuggestions = useMemo(() => {
    const keyword = facultySearch.trim().toLowerCase();
    if (!keyword) return [];
    return ckanUserOptions
      .filter((ckanUser) =>
        String(ckanUser.name || "")
          .toLowerCase()
          .includes(keyword),
      )
      .filter((ckanUser) => !facultyTeamSelections.includes(ckanUser.name))
      .slice(0, 8);
  }, [facultySearch, ckanUserOptions, facultyTeamSelections]);

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
    const hasMissingOutputFile = expectedOutputRows.some((row) => {
      const hasPendingFile = Boolean(row?.file);
      const hasSavedPath = Boolean(String(row?.file_path || "").trim());
      return !hasPendingFile && !hasSavedPath;
    });
    if (hasMissingOutputFile) {
      return "Each expected output must have an attached file before submission.";
    }

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

  const addProponentSelection = (field, name) => {
    const current = splitCsvNames(form[field]);
    if (current.includes(name)) return;
    updateProponentMultiSelect(field, [...current, name]);
  };

  const removeProponentSelection = (field, name) => {
    const current = splitCsvNames(form[field]);
    updateProponentMultiSelect(
      field,
      current.filter((item) => item !== name),
    );
  };

  const setLeadResearcherSelection = (name) => {
    setForm((prev) => ({
      ...prev,
      lead_researcher: String(name || "").trim(),
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
    const selectedFile = newOutputDraft.file;
    const isEditMode = Boolean(editingOutputClientId);
    const existingRow = isEditMode
      ? expectedOutputRows.find(
          (row) => row.client_id === editingOutputClientId,
        )
      : null;

    setError("");
    setMessage("");
    if (selectedFile) {
      if (selectedFile.size > MAX_OUTPUT_FILE_SIZE_BYTES) {
        setError("Each expected output file must be 25MB or smaller.");
        return;
      }
    }
    if (!selectedFile && !String(newOutputDraft.file_path || "").trim()) {
      setError("Expected output file is required.");
      return;
    }

    const nextRow = {
      ...newOutputDraft,
      output_type: normalizedType,
      target_count: normalizedTargetCount,
      notes: String(newOutputDraft.notes || "").trim(),
      file: selectedFile || null,
      file_path: selectedFile ? "" : newOutputDraft.file_path || "",
      file_name: selectedFile
        ? selectedFile.name || ""
        : newOutputDraft.file_name || "",
      mime_type: selectedFile
        ? selectedFile.type || ""
        : newOutputDraft.mime_type || "",
      file_size: selectedFile
        ? selectedFile.size || null
        : newOutputDraft.file_size || null,
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

  const synchronizeExpectedOutputs = async (projectId) => {
    if (!projectId) {
      return { error: new Error("Missing project ID for expected outputs.") };
    }

    const { data: oldRows, error: oldRowsError } =
      await fetchProjectExpectedOutputs({
        projectId,
      });
    if (oldRowsError) return { error: oldRowsError };

    const newlyCreatedOutputIds = [];
    const newlyUploadedPaths = [];
    const savedRows = [];

    try {
      for (const row of expectedOutputRows) {
        const normalizedType = String(row.output_type || "").trim();
        const normalizedTargetCount = Math.max(
          1,
          Number(row.target_count) || 0,
        );
        if (!normalizedType) {
          throw new Error("Expected output type is required.");
        }
        if (normalizedTargetCount < 1) {
          throw new Error("Target count must be at least 1.");
        }
        if (!row.file && !String(row.file_path || "").trim()) {
          throw new Error(
            "Each expected output must have an attached file before submission.",
          );
        }

        const { data: insertedRow, error: insertError } =
          await insertProjectExpectedOutput({
            projectId,
            outputType: normalizedType,
            targetCount: normalizedTargetCount,
            notes: row.notes,
          });
        if (insertError) throw insertError;
        newlyCreatedOutputIds.push(insertedRow.id);

        let dbRow = insertedRow;
        if (row.file) {
          const storagePath = `${projectId}/expected-outputs/${dbRow.id}/${Date.now()}-${sanitizeFileName(row.file.name)}`;
          const { data: uploadedOutputFile, error: uploadError } =
            await uploadExpectedOutputFileToStorage({
              storagePath,
              file: row.file,
              contentType: row.file.type || "application/octet-stream",
            });
          if (uploadError) throw uploadError;
          if (!String(uploadedOutputFile?.path || "").trim()) {
            throw new Error(
              "CKAN resource URL was not returned after file upload.",
            );
          }
          newlyUploadedPaths.push(storagePath);

          const { data: fileUpdated, error: fileUpdateError } =
            await updateProjectExpectedOutputFile({
              outputId: dbRow.id,
              filePath: uploadedOutputFile?.path || null,
              fileName: row.file.name,
              mimeType: row.file.type || null,
              fileSize: row.file.size || null,
            });
          if (fileUpdateError) throw fileUpdateError;
          dbRow = fileUpdated;
        } else if (row.file_path) {
          const { data: fileMetaCopied, error: fileMetaCopyError } =
            await updateProjectExpectedOutputFile({
              outputId: dbRow.id,
              filePath: row.file_path,
              fileName: row.file_name || null,
              mimeType: row.mime_type || null,
              fileSize: row.file_size || null,
            });
          if (fileMetaCopyError) throw fileMetaCopyError;
          dbRow = fileMetaCopied;
          if (String(row.file_path).startsWith("draft/")) {
            const finalPath = `${projectId}/expected-outputs/${dbRow.id}/${Date.now()}-${sanitizeFileName(row.file_name || "output-file")}`;
            const { error: copyError } = await copyExpectedOutputFileInStorage({
              fromPath: row.file_path,
              toPath: finalPath,
            });
            if (copyError) throw copyError;

            const { data: movedFileMeta, error: movedMetaError } =
              await updateProjectExpectedOutputFile({
                outputId: dbRow.id,
                filePath: finalPath,
                fileName: row.file_name || null,
                mimeType: row.mime_type || null,
                fileSize: row.file_size || null,
              });
            if (movedMetaError) throw movedMetaError;
            dbRow = movedFileMeta;
            newlyUploadedPaths.push(row.file_path);
          }
        }

        savedRows.push(mapDbOutputToLocalRow(dbRow));
      }

      const oldOutputIds = (oldRows || []).map((row) => row.id);
      const { error: deleteOldRowsError } = await deleteProjectExpectedOutputs({
        outputIds: oldOutputIds,
      });
      if (deleteOldRowsError) throw deleteOldRowsError;

      const oldPaths = new Set(
        (oldRows || []).map((row) => row.file_path).filter(Boolean),
      );
      const newPaths = new Set(
        savedRows.map((row) => row.file_path).filter(Boolean),
      );
      const orphanPaths = [...oldPaths].filter((path) => !newPaths.has(path));
      if (orphanPaths.length > 0) {
        const { error: removeOldFilesError } =
          await removeExpectedOutputFilesFromStorage({
            filePaths: orphanPaths,
          });
        if (removeOldFilesError) throw removeOldFilesError;
      }

      return { error: null, rows: savedRows };
    } catch (runtimeError) {
      if (newlyCreatedOutputIds.length > 0) {
        await deleteProjectExpectedOutputs({
          outputIds: newlyCreatedOutputIds,
        });
      }
      if (newlyUploadedPaths.length > 0) {
        await removeExpectedOutputFilesFromStorage({
          filePaths: newlyUploadedPaths,
        });
      }
      return { error: runtimeError };
    }
  };

  const submit = async () => {
    setSubmitting(true);
    const summaryText = buildExpectedOutputsSummary(expectedOutputRows);
    let moaReference = form.signed_moa_reference || null;
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
    }

    const formForSave = {
      ...form,
      expected_outputs: summaryText,
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
      expectedOutputs: expectedOutputRows,
    });

    if (mode === "revise") {
      if (saveError || !data) {
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
      navigate("/my-submissions");
      return;
    }

    if (saveError) {
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
  };

  return (
    <section className="page-stack-lg pb-24 lg:pb-0">
      <PageHeader
        title={editId ? "Revise Research Project" : "Submit Research Project"}
        description="Use step-by-step form completion. Your draft is auto-saved in this browser."
        actions={
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate("/submit-affiliation")}
          >
            Go back
          </button>
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
        <div className="panel">
          <div className="panel-body text-sm text-slate-600">
            Loading submission for revision...
          </div>
        </div>
      ) : null}

      <form className="panel overflow-hidden" onSubmit={handleSubmitAttempt}>
        <div className="panel-header flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            {SUBMISSION_STEPS[step].label}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={clearDraft}
            >
              Clear Draft
            </button>
          </div>
        </div>

        <div className="panel-body grid w-full gap-6">
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
                <input
                  className="control-input"
                  placeholder="e.g. AI Mentorship in Public Schools"
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                />
                <p className="text-xs text-slate-500">
                  Use a concise, descriptive title that will appear in reports.
                </p>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Project abstract/summary
                </span>
                <textarea
                  className="control-textarea min-h-24"
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
                  <p className="form-section-title">
                    Research Team
                  </p>
                </div>
              <div className="form-fields-grid form-fields-grid-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Lead researcher
                  </span>
                  <div ref={leadFieldRef} className="relative space-y-2">
                    <input
                      className="control-input"
                      placeholder="Type a CKAN user name"
                      value={leadSearch}
                      onFocus={() => setLeadDropdownOpen(true)}
                      onChange={(e) => {
                        setLeadSearch(e.target.value);
                        setLeadDropdownOpen(true);
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
                              setLeadResearcherSelection(ckanUser.name);
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
                  <div className="app-card-muted app-card-micro">
                    {!selectedLeadResearcher ? (
                      <p className="text-xs text-slate-500">
                        No CKAN user selected yet.
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
                            onClick={() => setLeadResearcherSelection("")}
                            aria-label={`Remove ${selectedLeadResearcher}`}
                          >
                            x
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Type to search and select one CKAN user only.
                  </p>
                </label>
                <label className="block space-y-1 text-sm lg:col-span-1">
                  <span className="font-semibold text-slate-700">
                    Research team (faculty)
                  </span>
                  <div ref={facultyFieldRef} className="relative space-y-2">
                    <input
                      className="control-input"
                      placeholder="Type a CKAN user name"
                      value={facultySearch}
                      onFocus={() => setFacultyDropdownOpen(true)}
                      onChange={(e) => {
                        setFacultySearch(e.target.value);
                        setFacultyDropdownOpen(true);
                      }}
                    />
                    {facultyDropdownOpen && facultySuggestions.length > 0 ? (
                      <div className="absolute z-10 max-h-56 w-full overflow-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-1 shadow-sm">
                        {facultySuggestions.map((ckanUser) => (
                          <button
                            key={`faculty-option-${ckanUser.id}`}
                            type="button"
                            className="w-full rounded px-2 py-1 text-left text-sm text-slate-700 hover:bg-[var(--surface-muted)]"
                            onClick={() => {
                              addProponentSelection(
                                "faculty_team",
                                ckanUser.name,
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
                  <div className="app-card-muted app-card-micro">
                    {facultyTeamSelections.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No CKAN users selected yet.
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
                                removeProponentSelection("faculty_team", name)
                              }
                              aria-label={`Remove ${name}`}
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Type to search and select one or more CKAN users.
                  </p>
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Research team (students)
                </span>
                <input
                  className="control-input"
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
                  <p className="form-section-title">
                    Project Context
                  </p>
                </div>
              <div className="form-fields-grid form-fields-grid-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Project year
                  </span>
                  <input
                    className="control-input"
                    type="number"
                    min="2000"
                    max="2100"
                    placeholder="e.g. 2026"
                    required
                    value={form.year}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, year: e.target.value }))
                    }
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Research center
                  </span>
                  <input
                    className="control-input"
                    value={
                      centerName === "-"
                        ? form.research_center_id || profile?.ckan_org_id || ""
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
                <p className="form-section-title">
                  Classification Details
                </p>
                <p className="form-section-note">
                  Classify the project for reporting, routing, and review.
                </p>
              </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Project classification
                </span>
                <select
                  className="control-select"
                  required
                  value={form.classification}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      classification: e.target.value,
                    }))
                  }
                >
                  <option value="academic">Academic</option>
                  <option value="industry">Industry</option>
                </select>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Status</span>
                <select
                  className="control-select"
                  required
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  <option value="proposal">Proposal</option>
                  <option value="ongoing">On-going</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Research agenda
                </span>
                <select
                  className="control-select"
                  value={form.research_agenda_id}
                  disabled={effectiveAgendas.length === 0}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      research_agenda_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Select research agenda</option>
                  {effectiveAgendas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {effectiveAgendas.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    No research agenda found in your organization custom fields
                    (CKAN extras).
                  </p>
                ) : null}
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Department</span>
                <input
                  className="control-input"
                  value={departmentName === "-" ? "" : departmentName}
                  readOnly
                  disabled
                />
              </label>
              <label className="block space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">
                  Scholarly type
                </span>
                <input
                  className="control-input"
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
                  <p className="form-section-title">
                    Funding Details
                  </p>
                  <p className="form-section-note">
                    Enter funding values and source details as accurately as possible.
                  </p>
                </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Funding type
                  </span>
                  <select
                    className="control-select"
                    value={form.funding_type}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        funding_type: e.target.value,
                      }))
                    }
                  >
                    <option value="none">None</option>
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                    <option value="self_funded">Self Funded</option>
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Funding category
                  </span>
                  <input
                    className="control-input"
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
                  <input
                    className="control-input"
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
                  <input
                    className="control-input"
                    placeholder="e.g. 50000"
                    type="number"
                    min="0"
                    value={form.funding_amount}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        funding_amount: e.target.value,
                    }))
                  }
                />
              </label>
              </div>
              </div>

              <div className="form-section">
                <div className="form-section-head">
                  <p className="form-section-title">
                    MOA and Timeline
                  </p>
                </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Industry/Agency partner
                  </span>
                  <input
                    className="control-input"
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
                      <label className="btn btn-outline upload-trigger">
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
                              setError("MOA file must be 25MB or smaller.");
                              e.target.value = "";
                              return;
                            }
                            setError("");
                            setMoaFile(nextFile);
                          }}
                        />
                      </label>
                    </div>
                    <div className="upload-field-preview">
                      <p className="upload-field-preview-text">
                        Current reference: {form.signed_moa_reference || "-"}
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
                  <input
                    className="control-input"
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
                  <input
                    className="control-input"
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
              <div className="app-card-muted app-card-compact text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  Submission checklist
                </p>
                <ul className="mt-1 list-disc pl-4">
                  <li>Title and center are filled.</li>
                  <li>Classification and year are valid.</li>
                  <li>Dates and funding values are logically consistent.</li>
                </ul>
              </div>

              <div className="form-section">
                <div className="form-section-head">
                  <p className="form-section-title">
                    Outputs and Resources
                  </p>
                  <p className="form-section-note">
                    Add expected outputs and link supporting evidence files.
                  </p>
                </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">
                    Expected research outputs
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={openAddOutputModal}
                  >
                    Add Output
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Rows are finalized in database when you submit/save revision.
                </p>
                <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-white">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Output Type</th>
                        <th>Target</th>
                        <th>Notes</th>
                        <th>File</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expectedOutputRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-4 text-center text-xs text-slate-500"
                          >
                            No expected outputs added yet.
                          </td>
                        </tr>
                      ) : (
                        paginatedExpectedOutputRows.map((row) => (
                          <tr key={row.client_id}>
                            <td>
                              {EXPECTED_OUTPUT_TYPE_OPTIONS.find(
                                (item) => item.value === row.output_type,
                              )?.label ||
                                row.output_type ||
                                "-"}
                            </td>
                            <td className="text-slate-600">
                              {Math.max(1, Number(row.target_count) || 1)}
                            </td>
                            <td className="text-slate-600">
                              {row.notes || "-"}
                              {row.needs_file_reselect ? (
                                <p className="text-xs text-amber-700">
                                  File needs re-attach after refresh.
                                </p>
                              ) : null}
                            </td>
                            <td className="text-slate-600 break-all">
                              {row.file_name ||
                                row.file?.name ||
                                row.file_path ||
                                "-"}
                            </td>
                            <td className="text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() => openEditOutputModal(row)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() =>
                                    deleteExpectedOutputRow(row.client_id)
                                  }
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
                <input
                  className="control-input"
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
                <div className="app-card">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Step 1: Project
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-semibold text-slate-700">
                        Project Title
                      </span>
                      <input
                        className="control-input"
                        value={form.title || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Lead Researcher
                      </span>
                      <input
                        className="control-input"
                        value={form.lead_researcher || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Project Year
                      </span>
                      <input
                        className="control-input"
                        value={form.year || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-semibold text-slate-700">
                        Research Center
                      </span>
                      <input
                        className="control-input"
                        value={centerName}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Faculty Team
                      </span>
                      <textarea
                        className="control-textarea min-h-20"
                        value={form.faculty_team || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Student Team
                      </span>
                      <textarea
                        className="control-textarea min-h-20"
                        value={form.student_team || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-semibold text-slate-700">
                        Abstract
                      </span>
                      <textarea
                        className="control-textarea min-h-24"
                        value={form.abstract || "-"}
                        readOnly
                      />
                    </label>
                  </div>
                </div>

                <div className="app-card">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Step 2: Classification
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Status
                      </span>
                      <input
                        className="control-input"
                        value={form.status || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Classification
                      </span>
                      <input
                        className="control-input"
                        value={form.classification || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Scholarly Type
                      </span>
                      <input
                        className="control-input"
                        value={form.scholarly_type || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Research Agenda
                      </span>
                      <input
                        className="control-input"
                        value={agendaName}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Department
                      </span>
                      <input
                        className="control-input"
                        value={departmentName}
                        readOnly
                      />
                    </label>
                  </div>
                </div>

                <div className="app-card">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                    Step 3: Funding & Timeline
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Funding Type
                      </span>
                      <input
                        className="control-input"
                        value={form.funding_type || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Funding Category
                      </span>
                      <input
                        className="control-input"
                        value={form.funding_category || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Funding Source
                      </span>
                      <input
                        className="control-input"
                        value={form.funding_source || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Funding Amount
                      </span>
                      <input
                        className="control-input"
                        value={form.funding_amount || "0"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Industry/Agency Partner
                      </span>
                      <input
                        className="control-input"
                        value={form.industry_partner || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Signed MOA Reference
                      </span>
                      <input
                        className="control-input"
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
                      <input
                        className="control-input"
                        value={form.start_date || "-"}
                        readOnly
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        End Date
                      </span>
                      <input
                        className="control-input"
                        value={form.end_date || "-"}
                        readOnly
                      />
                    </label>
                  </div>
                </div>

                <div className="app-card">
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
                            <div
                              key={`review-output-${row.client_id}`}
                              className="app-card app-card-micro text-sm"
                            >
                              <p className="font-semibold text-slate-800">
                                {EXPECTED_OUTPUT_TYPE_OPTIONS.find(
                                  (item) => item.value === row.output_type,
                                )?.label ||
                                  row.output_type ||
                                  "-"}
                              </p>
                              <p className="text-slate-600">
                                Target:{" "}
                                {Math.max(1, Number(row.target_count) || 1)} |
                                Notes: {row.notes || "-"}
                              </p>
                              <p className="text-slate-600 break-all">
                                File:{" "}
                                {row.file?.name ||
                                  row.file_name ||
                                  row.file_path ||
                                  "-"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </label>
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-semibold text-slate-700">
                        Supporting MOV Link
                      </span>
                      <input
                        className="control-input"
                        value={form.supporting_mov_link || "-"}
                        readOnly
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {step > 0 ? (
              <button
                type="button"
                className={`btn btn-outline ${disabledOutlineButtonClass}`}
                onClick={() => moveStep(-1)}
              >
                Previous
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {step < SUBMISSION_STEPS.length - 1 ? (
                <button
                  type="button"
                  className={`btn btn-primary ${disabledButtonClass}`}
                  onClick={(event) => {
                    event.preventDefault();
                    moveStep(1);
                  }}
                  disabled={Boolean(
                    validateSubmissionStep(form, step, expectedOutputRows),
                  )}
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  className={`btn btn-primary ${disabledButtonClass}`}
                  disabled={Boolean(getSubmissionValidationError())}
                >
                  {editId ? "Save Revision" : "Submit Research Project"}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      <div className="fixed bottom-3 left-3 right-3 z-20 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white/95 p-2 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2">
          {step > 0 ? (
            <button
              type="button"
              className={`btn btn-outline ${disabledOutlineButtonClass}`}
              onClick={() => moveStep(-1)}
            >
              Prev
            </button>
          ) : (
            <span />
          )}
          {step < SUBMISSION_STEPS.length - 1 ? (
            <button
              type="button"
              className={`btn btn-primary ${disabledButtonClass}`}
              onClick={(event) => {
                event.preventDefault();
                moveStep(1);
              }}
              disabled={Boolean(
                validateSubmissionStep(form, step, expectedOutputRows),
              )}
            >
              Next Step
            </button>
          ) : (
            <button
              type="button"
              className={`btn btn-primary ${disabledButtonClass}`}
              onClick={handleSubmitAttempt}
              disabled={Boolean(getSubmissionValidationError())}
            >
              {editId ? "Save" : "Submit Project"}
            </button>
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

      {showAddOutputModal ? (
        <div
          className="modal-overlay modal-overlay-centered"
          onClick={closeAddOutputModal}
        >
          <div
            className="modal-dialog modal-dialog-md"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-base font-bold text-slate-900">
              {editingOutputClientId ? "Edit Output" : "Add Output"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Fill out the output details, then click{" "}
              {editingOutputClientId ? "Save" : "Add"} to list it in Step 4.
            </p>
            <div className="mt-3 space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Output type
                </span>
                <select
                  className="control-select"
                  value={newOutputDraft.output_type}
                  onChange={(e) =>
                    setNewOutputDraft((prev) => ({
                      ...prev,
                      output_type: e.target.value,
                    }))
                  }
                >
                  <option value="">Select output type</option>
                  {EXPECTED_OUTPUT_TYPE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Target count
                </span>
                <input
                  className="control-input"
                  type="number"
                  min={1}
                  step={1}
                  value={newOutputDraft.target_count}
                  onChange={(e) =>
                    setNewOutputDraft((prev) => ({
                      ...prev,
                      target_count: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Notes</span>
                <input
                  className="control-input"
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
                    <label className="btn btn-outline upload-trigger">
                      <Upload size={14} aria-hidden="true" />
                      <span>{newOutputDraft.file ? "Replace" : "Choose File"}</span>
                      <input
                        className="sr-only"
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={(e) => {
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
                          setNewOutputDraft((prev) => ({
                            ...prev,
                            file: selectedFile,
                            file_name: selectedFile?.name || "",
                            mime_type: selectedFile?.type || "",
                            file_size: selectedFile?.size || null,
                            file_path: "",
                            needs_file_reselect: false,
                          }));
                        }}
                      />
                    </label>
                  </div>
                  <div className="upload-field-preview">
                    <p className="upload-field-hint">
                      Allowed: PDF, DOC, XLS, PNG, JPG | Max 25MB
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeAddOutputModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveNewExpectedOutput}
              >
                {editingOutputClientId ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
