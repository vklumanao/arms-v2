import { useEffect } from "react";
import {
  clampSubmissionStep,
  createLocalOutputRow,
  parseSavedSubmissionDraft,
} from "@/utils/submissions";

export default function useSubmissionDraft({
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
}) {
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
  }, [
    draftKey,
    editId,
    hasDraftExpectedOutputsRef,
    setDraftHydrated,
    setExpectedOutputRows,
    setForm,
    setStep,
  ]);

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
  }, [
    draftKey,
    draftHydrated,
    editId,
    expectedOutputRows,
    form,
    skipNextAutosaveRef,
    step,
  ]);
}
