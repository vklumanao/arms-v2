function buildCoreStartDescription(role) {
  const roleTrack =
    role === "admin"
      ? "Admin track: Controls -> Users -> Affiliates"
      : "Faculty/Student track: Profile -> Submit Project -> Outputs/MOV -> My Submissions -> Publications";
  return [
    "Welcome to ARMS guided onboarding.",
    "Core process:",
    "1) Complete profile",
    "2) Submit research project form",
    "3) Attach outputs and MOV evidence",
    "4) Track lifecycle and decisions",
    "5) Publish/report approved records",
    roleTrack,
  ].join("\n");
}

const sharedCoreSteps = (role) => [
  {
    element: "#onboarding-start-tour",
    popover: {
      title: "Core ARMS Process",
      description: buildCoreStartDescription(role),
      side: "bottom",
      align: "end",
    },
  },
  {
    element: "#onboarding-notifications",
    popover: {
      title: "Action Alerts",
      description:
        "Use this for assignment, review, and deadline alerts so no workflow item is missed.",
      side: "bottom",
      align: "end",
    },
  },
  {
    path: "/public-records",
    element: "#onboarding-public-records",
    popover: {
      title: "Public Registry",
      description:
        "Approved and visible outputs appear in the public registry for transparency and dissemination.",
      side: "right",
      align: "start",
    },
  },
];

const facultyStudentFlowSteps = [
  {
    path: "/dashboard",
    element: "#onboarding-dashboard",
    popover: {
      title: "Workflow Dashboard",
      description:
        "Start here to monitor your active projects and current project status.",
      side: "right",
      align: "start",
    },
  },
  {
    path: "/affiliate-profile",
    element: "#onboarding-affiliate-profile",
    popover: {
      title: "Step 1: Complete Profile",
      description:
        "Keep profile details accurate before submitting projects to avoid attribution issues.",
      side: "right",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation",
    element: "#onboarding-submit-proposal",
    popover: {
      title: "Step 2: Start Submission",
      description:
        "Open Research Projects to create or revise a project submission.",
      side: "right",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation/submit",
    element: "#onboarding-submission-flow",
    popover: {
      title: "Progressive Form Flow",
      description:
        "This form is sequential. Complete each section to unlock the next and reduce validation errors.",
      side: "bottom",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation/submit",
    element: "#onboarding-form-project-title",
    popover: {
      title: "Form Tour: Project Basics",
      description:
        "Begin with a clear title. This appears in review, reports, and public records once approved.",
      side: "bottom",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation/submit",
    element: "#onboarding-form-lead-researcher",
    popover: {
      title: "Form Tour: Lead Researcher",
      description:
        "Select the exact CKAN user for the lead researcher for correct ownership and tracking.",
      side: "bottom",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation/submit",
    element: "#onboarding-form-classification",
    popover: {
      title: "Form Tour: Classification",
      description:
        "Set classification and status correctly. These control routing and reporting.",
      side: "bottom",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation/submit",
    element: "#onboarding-form-agenda",
    popover: {
      title: "Form Tour: Research Agenda",
      description:
        "Choose the right agenda to align the project with your center priorities.",
      side: "bottom",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation/submit",
    element: "#onboarding-form-moa",
    popover: {
      title: "Form Tour: MOA Reference",
      description:
        "Attach signed MOA reference when available. Keep file size and format within limits.",
      side: "top",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation/submit",
    element: "#onboarding-form-add-output",
    popover: {
      title: "Form Tour: Expected Outputs",
      description:
        "Add each output with target count and file evidence to strengthen evaluation quality.",
      side: "left",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation/submit",
    element: "#onboarding-form-mov-link",
    popover: {
      title: "Form Tour: MOV Link",
      description:
        "Provide a stable repository link (Drive/folder) for supporting MOVs.",
      side: "bottom",
      align: "start",
    },
  },
  {
    path: "/submit-affiliation/submit",
    element: "#onboarding-form-submit",
    popover: {
      title: "Finalize Submission",
      description:
        "Submit only after review step checks are complete. You can revise drafts before finalizing.",
      side: "top",
      align: "end",
    },
  },
  {
    path: "/my-submissions",
    element: "#onboarding-my-submissions",
    popover: {
      title: "Step 4: Track Status",
      description:
        "Use My Submissions to follow decisions, revisions, and timeline changes.",
      side: "right",
      align: "start",
    },
  },
  {
    path: "/publications",
    element: "#onboarding-publications",
    popover: {
      title: "Step 5: Publish Outputs",
      description:
        "Maintain publication records linked to approved project outcomes.",
      side: "right",
      align: "start",
    },
  },
];

const adminFlowSteps = [
  {
    path: "/dashboard",
    element: "#onboarding-dashboard",
    popover: {
      title: "Admin Operations Dashboard",
      description:
        "Monitor workload, status distribution, and center-level progress.",
      side: "right",
      align: "start",
    },
  },
  {
    path: "/admin/controls",
    element: "#onboarding-admin-controls",
    popover: {
      title: "Governance Controls",
      description:
        "Maintain centers, references, and dependencies used by validations.",
      side: "right",
      align: "start",
    },
  },
  {
    path: "/admin/users",
    element: "#onboarding-admin-users",
    popover: {
      title: "User Management",
      description:
        "Manage role and account status with audit-traceable changes.",
      side: "right",
      align: "start",
    },
  },
];

export function getOnboardingTourSteps(role) {
  if (role === "admin") {
    return [...sharedCoreSteps(role), ...adminFlowSteps];
  }
  return [...sharedCoreSteps(role), ...facultyStudentFlowSteps];
}
