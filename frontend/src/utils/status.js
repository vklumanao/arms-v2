export function normalizeStatus(status) {
  const key = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (key === "for_approval" || key === "pending") return "proposal";
  if (key === "on_going") return "ongoing";
  if (key === "active") return "ongoing";
  return key;
}

export function formatStatusLabel(status) {
  const normalized = normalizeStatus(status);
  if (!normalized) return "";
  const map = {
    proposal: "Proposal",
    ongoing: "Ongoing",
    completed: "Completed",
    rejected: "Rejected",
  };
  if (map[normalized]) return map[normalized];
  return normalized
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}
