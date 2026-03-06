export function normalizeStatus(status) {
  const key = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (key === "for_approval" || key === "pending") return "proposal";
  if (key === "on_going") return "ongoing";
  return key;
}

