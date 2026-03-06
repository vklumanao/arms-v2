export function getOnboardingTourSteps(role) {
  const sharedCoreSteps = [
    {
      element: "#onboarding-start-tour",
      popover: {
        title: "System Walkthrough",
        description:
          "This tutorial covers core ARMS workflows and can be replayed anytime.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "#onboarding-notifications",
      popover: {
        title: "In-App Notifications",
        description:
          "Critical updates for reviews, deadlines, and assignment changes appear here.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "#onboarding-public-records",
      popover: {
        title: "Public Records",
        description:
          "This is the public-facing registry for approved and visible project records.",
        side: "right",
        align: "start",
      },
    },
  ];

  if (role === "admin") {
    return [
      ...sharedCoreSteps,
      {
        element: "#onboarding-dashboard",
        popover: {
          title: "Admin Command View",
          description:
            "Track proposal volumes, lifecycle distribution, and admin workload.",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#onboarding-admin-review-queue",
        popover: {
          title: "Review Queue (Core)",
          description:
            "Primary workflow: assign reviewers and make approve/reject decisions.",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#onboarding-admin-users",
        popover: {
          title: "User Management",
          description:
            "Maintain user roles and activation status with role-change traceability.",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#onboarding-admin-affiliates",
        popover: {
          title: "Affiliate Registry",
          description:
            "Validate affiliate records used by submissions, reports, and compliance views.",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#onboarding-admin-reports",
        popover: {
          title: "Reports (Core)",
          description:
            "Generate operational, compliance, and decision-support reports.",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#onboarding-admin-audit",
        popover: {
          title: "Audit Console (Core)",
          description:
            "Review high-risk actions and evidence trails for accountability checks.",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#onboarding-admin-controls",
        popover: {
          title: "Admin Controls",
          description:
            "Configure governance references that drive validations and workflows.",
          side: "right",
          align: "start",
        },
      },
    ];
  }

  return [
    ...sharedCoreSteps,
    {
      element: "#onboarding-dashboard",
      popover: {
        title: "Workflow Dashboard",
        description:
          "Monitor your active proposals and current lifecycle status in one place.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "#onboarding-affiliate-profile",
      popover: {
        title: "Affiliate Profile",
        description:
          "Keep profile details accurate for attribution, outputs, and reporting quality.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "#onboarding-submit-proposal",
      popover: {
        title: "Research Projects (Core)",
        description:
          "This is the main entry point to create a new research submission.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "#onboarding-my-submissions",
      popover: {
        title: "My Submissions (Core)",
        description:
          "Track decisions, revise proposals, and upload MOV evidence here.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "#onboarding-publications",
      popover: {
        title: "Publications",
        description:
          "Maintain publication outputs linked to your approved project records.",
        side: "right",
        align: "start",
      },
    },
  ];
}

