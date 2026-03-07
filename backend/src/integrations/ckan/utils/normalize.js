export function safeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function toText(value) {
  if (value == null) return "";
  return String(value).trim();
}
