/**
 * Converts value to CKAN-friendly slug token.
 *
 * Data transformation:
 * - Lowercases, strips unsupported chars, trims separators, and enforces length cap.
 */
export function safeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Converts nullable input to trimmed string.
 */
export function toText(value) {
  if (value == null) return "";
  return String(value).trim();
}
