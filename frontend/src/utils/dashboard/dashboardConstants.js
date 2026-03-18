import { CheckCircle2, Clock3, FileText, XCircle } from "lucide-react";

export const FEATURED_PAGE_SIZE = 4;
export const ACTIVITY_PAGE_SIZE = 6;
export const RECORDS_PAGE_SIZE = 8;

export const QUICK_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "mine", label: "My Projects" },
  { value: "completed", label: "Completed" },
  { value: "needs_action", label: "Needs Action" },
];

export const STATUS_FILTER_OPTIONS = [
  "proposal",
  "ongoing",
  "completed",
  "rejected",
];

export const DASHBOARD_COUNT_META = {
  proposal: { label: "Proposal", icon: FileText },
  ongoing: { label: "Ongoing", icon: Clock3 },
  completed: { label: "Completed", icon: CheckCircle2 },
  rejected: { label: "Rejected", icon: XCircle },
};

export const ENABLE_DEADLINE_NOTIFY_RPC =
  import.meta.env.VITE_ENABLE_DEADLINE_NOTIFY_RPC === "true";
