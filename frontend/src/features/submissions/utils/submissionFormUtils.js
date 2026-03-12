export const SUBMISSION_STEPS = [
  { id: 0, label: "Project" },
  { id: 1, label: "Classification" },
  { id: 2, label: "Funding & Timeline" },
  { id: 3, label: "Outputs & Visibility" },
  { id: 4, label: "Review & Submit" },
];

export const EXPECTED_OUTPUT_TYPE_OPTIONS = [
  { value: "publication", label: "Publication" },
  { value: "patent_ip", label: "Patent / Intellectual Property" },
  { value: "people_services", label: "People Services" },
  { value: "places_partnerships", label: "Places and Partnerships" },
  { value: "policies", label: "Policies" },
  { value: "product_software", label: "Product/Software Application" },
  { value: "others", label: "Others" },
];

export const INITIAL_SUBMISSION_FORM = {
  title: "",
  lead_researcher: "",
  lead_researcher_user: null,
  faculty_team: "",
  faculty_team_users: [],
  student_team: "",
  abstract: "",
  year: new Date().getFullYear(),
  research_center_id: "",
  research_agenda_id: "",
  department_id: "",
  scholarly_type: "",
  funding_type: "none",
  funding_category: "",
  industry_partner: "",
  funding_source: "",
  funding_amount: "0",
  classification: "academic",
  status: "ongoing",
  expected_outputs: "",
  expected_outputs_items: [],
  supporting_mov_link: "",
  signed_moa_reference: "",
  start_date: "",
  end_date: "",
  public_visible: false,
};

export function getSubmissionDraftKey(userId, editId) {
  return `arms_submit_draft:${userId || "anon"}:${editId || "new"}`;
}

export function mapProjectToSubmissionForm(project) {
  return {
    title: project?.title || "",
    lead_researcher: project?.lead_researcher || "",
    lead_researcher_user: project?.lead_researcher_user || null,
    faculty_team: project?.faculty_team || "",
    faculty_team_users: Array.isArray(project?.faculty_team_users)
      ? project.faculty_team_users
      : [],
    student_team: project?.student_team || "",
    abstract: project?.abstract || "",
    year: project?.year || new Date().getFullYear(),
    research_center_id: project?.research_center_id || "",
    research_agenda_id: project?.research_agenda_id || "",
    department_id: project?.department_id || "",
    scholarly_type: project?.scholarly_type || "",
    funding_type: project?.funding_type || "none",
    funding_category: project?.funding_category || "",
    industry_partner: project?.industry_partner || "",
    funding_source: project?.funding_source || "",
    funding_amount: String(project?.funding_amount ?? "0"),
    classification: project?.classification || "academic",
    status: project?.status || "ongoing",
    expected_outputs: project?.expected_outputs || "",
    expected_outputs_items: [],
    supporting_mov_link: project?.supporting_mov_link || "",
    signed_moa_reference: project?.signed_moa_reference || "",
    start_date: project?.start_date || "",
    end_date: project?.end_date || "",
    public_visible: Boolean(project?.public_visible),
  };
}

export function parseSavedSubmissionDraft(raw) {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clampSubmissionStep(
  step,
  maxStep = SUBMISSION_STEPS.length - 1,
) {
  return Math.max(0, Math.min(maxStep, step));
}

export function validateSubmissionStep(form, step, expectedOutputRows = []) {
  if (step === 0) {
    if (!form.title.trim()) return "Project title is required.";
    if (!form.lead_researcher.trim()) return "Lead researcher is required.";
    if (!form.faculty_team.trim())
      return "Research team (faculty) is required.";
    if (!form.research_center_id) return "Research center is required.";
    if (!form.year || Number(form.year) < 2000 || Number(form.year) > 2100) {
      return "Project year must be between 2000 and 2100.";
    }
  }
  if (step === 1) {
    if (!form.classification) return "Classification is required.";
    if (!form.status) return "Status is required.";
    if (!form.research_agenda_id) return "Research agenda is required.";
    if (!form.department_id) return "Department is required.";
    if (!form.scholarly_type.trim()) return "Scholarly type is required.";
  }
  if (step === 2) {
    if (form.funding_amount && Number(form.funding_amount) < 0) {
      return "Funding amount cannot be negative.";
    }
    if (!form.start_date) return "Start date is required.";
    if (!form.end_date) return "End date is required.";
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      return "End date cannot be earlier than start date.";
    }
  }
  if (step === 3) {
    if (!expectedOutputRows.length) return "";
    const validTypeSet = new Set(
      EXPECTED_OUTPUT_TYPE_OPTIONS.map((item) => item.value),
    );
    for (const row of expectedOutputRows) {
      if (!row.output_type || !validTypeSet.has(row.output_type)) {
        return "Each expected output must have a valid type.";
      }
      const targetCount = Number(row.target_count);
      if (!Number.isFinite(targetCount) || targetCount < 1) {
        return "Each expected output must have a target count of at least 1.";
      }
      if (
        String(row.output_type || "").trim() === "product_software" &&
        !String(row.specific_output || "").trim()
      ) {
        return "Specific output is required for Product/Software Application.";
      }
    }
  }
  return "";
}

export function canAccessSubmissionStep(
  form,
  targetStep,
  expectedOutputRows = [],
) {
  if (targetStep <= 0) return true;
  for (let i = 0; i < targetStep; i += 1) {
    if (validateSubmissionStep(form, i, expectedOutputRows)) return false;
  }
  return true;
}

export function getHighestUnlockedSubmissionStep(
  form,
  expectedOutputRows = [],
) {
  for (let i = SUBMISSION_STEPS.length - 1; i >= 0; i -= 1) {
    if (canAccessSubmissionStep(form, i, expectedOutputRows)) return i;
  }
  return 0;
}


export function splitCsvNames(raw) {
  const value = String(raw || "").trim();
  if (!value) return [];
  if (value.includes(";")) {
    return value
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
}

export function toCsvNames(items) {
  return [
    ...new Set((items || []).map((item) => item.trim()).filter(Boolean)),
  ].join("; ");
}

export function sanitizeFileName(fileName) {
  return String(fileName || "moa-file")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "");
}

export function createLocalOutputRow() {
  return {
    id: null,
    client_id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    output_type: "",
    target_count: 1,
    specific_output: "",
    notes: "",
    file_path: "",
    file_name: "",
    mime_type: "",
    file_size: null,
    file: null,
    needs_file_reselect: false,
    is_saved: false,
  };
}

export function mapDbOutputToLocalRow(row) {
  return {
    id: row.id,
    client_id: row.id,
    output_type: row.output_type || "",
    target_count: Math.max(1, Number(row.target_count) || 1),
    specific_output: "",
    notes: row.notes || "",
    file_path: row.file_path || "",
    file_name: row.file_name || "",
    mime_type: row.mime_type || "",
    file_size: row.file_size ?? null,
    file: null,
    needs_file_reselect: false,
    is_saved: true,
  };
}

export function buildExpectedOutputsSummary(rows) {
  const labelsByValue = EXPECTED_OUTPUT_TYPE_OPTIONS.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});
  return (rows || [])
    .map((row) => {
      const label = labelsByValue[row.output_type] || row.output_type;
      const targetCount = Math.max(1, Number(row.target_count) || 1);
      return label ? `${label} (Target: ${targetCount})` : "";
    })
    .filter(Boolean)
    .join(", ");
}
