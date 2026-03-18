export const INITIAL_PUBLIC_RECORD_FILTERS = {
  search: "",
  status: "",
  year: "",
  center: "",
  department: "",
  classification: "",
  sort: "most_recent",
};

export const PUBLIC_RECORD_PRESETS = [
  { id: "all", label: "All Records" },
  { id: "completed", label: "Completed Only" },
  { id: "industry", label: "Industry Projects" },
  { id: "this_year", label: "This Year" },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

export function parseSearchTokens(input) {
  const tokens = {};
  const freeTerms = [];
  const parts = String(input || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  parts.forEach((part) => {
    const idx = part.indexOf(":");
    if (idx > 0) {
      const key = part.slice(0, idx).toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (
        ["year", "status", "center", "department", "classification"].includes(
          key,
        ) &&
        value
      ) {
        tokens[key] = value;
        return;
      }
    }
    freeTerms.push(part);
  });

  return { tokens, freeText: freeTerms.join(" "), terms: freeTerms };
}

export function highlightText(text, terms) {
  const content = String(text || "");
  if (!terms || terms.length === 0) return content;

  const escaped = terms
    .map((term) => term.trim())
    .filter(Boolean)
    .map(escapeRegExp);
  if (escaped.length === 0) return content;

  const regex = new RegExp(`(${escaped.join("|")})`, "ig");
  const segments = content.split(regex);

  return segments.map((segment, idx) =>
    idx % 2 === 1 ? (
      <mark key={`${segment}-${idx}`} className="rounded bg-amber-100 px-0.5">
        {segment}
      </mark>
    ) : (
      <span key={`${segment}-${idx}`}>{segment}</span>
    ),
  );
}

export function normalizeForCompare(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function buildApaCitation(record, centerName, departmentName) {
  const year = record.year || "n.d.";
  return `${record.title}. (${year}). ARMS Public Research Records. ${centerName || "Unknown Center"}${departmentName ? `, ${departmentName}` : ""}.`;
}

export function buildMlaCitation(record, centerName, departmentName) {
  const year = record.year || "n.d.";
  return `"${record.title}." ARMS Public Research Records, ${year}, ${centerName || "Unknown Center"}${departmentName ? `, ${departmentName}` : ""}.`;
}
