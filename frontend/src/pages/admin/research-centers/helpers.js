import { EMPTY_EDITING, SOCIAL_MEDIA_OPTIONS } from "./constants";

export function toId(value) {
  return String(value || "").trim();
}

export function getSocialPlatformFromLink(link) {
  const value = String(link || "")
    .trim()
    .toLowerCase();
  if (!value) return "facebook";
  if (value.includes("facebook.com") || value.includes("fb.com")) {
    return "facebook";
  }
  if (value.includes("instagram.com")) return "instagram";
  if (value.includes("x.com") || value.includes("twitter.com")) return "x";
  if (value.includes("linkedin.com")) return "linkedin";
  if (value.includes("youtube.com") || value.includes("youtu.be")) {
    return "youtube";
  }
  return "website";
}

export function getSocialPlaceholder(platform) {
  const match = SOCIAL_MEDIA_OPTIONS.find((item) => item.value === platform);
  return match?.placeholder || "https://example.com";
}

export function createEditingState(row, agendaNames = []) {
  return {
    ...EMPTY_EDITING,
    id: row?.id || null,
    name: row?.name === "-" ? "" : String(row?.name || ""),
    code: row?.code === "-" ? "" : String(row?.code || ""),
    description: String(row?.description || "").trim(),
    socialMediaLink: String(row?.socialMediaLink || "").trim(),
    socialMediaPlatform: getSocialPlatformFromLink(row?.socialMediaLink),
    centerChiefId: String(row?.centerChiefId || "").trim(),
    researchAgendas: agendaNames,
  };
}

export function normalizeUniqueNames(items = []) {
  return [
    ...new Set(items.map((item) => String(item || "").trim()).filter(Boolean)),
  ];
}

export function addUniqueTrimmedItem(items, nextValue) {
  const next = String(nextValue || "").trim();
  if (!next) return { items, added: false };
  const exists = (items || []).some(
    (item) => String(item || "").toLowerCase() === next.toLowerCase(),
  );
  if (exists) return { items, added: false };
  return { items: [...(items || []), next], added: true };
}

export function removeItem(items, valueToRemove) {
  return (items || []).filter((item) => item !== valueToRemove);
}

export function buildResearchCenterCsvContent(dataset) {
  const headers = [
    "center_code",
    "center_name",
    "research_center_type",
    "linked_affiliates",
    "linked_projects",
    "total_links",
  ];
  const lines = (dataset || []).map((row) =>
    [
      row.code,
      row.name,
      row.type,
      row.profileCount,
      row.projectCount,
      row.totalLinks,
    ]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export function buildResearchCenterPdfRowsHtml(dataset) {
  return (dataset || [])
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${row.code}</td>
          <td>${row.name}</td>
          <td>${row.type}</td>
          <td>${row.profileCount}</td>
          <td>${row.projectCount}</td>
          <td>${row.totalLinks}</td>
        </tr>
      `,
    )
    .join("");
}

export function buildDeleteGuard(deletingRow) {
  if (!deletingRow) {
    return { blocked: false, confirmLabel: "Delete", message: "" };
  }

  const projectCount = Number(deletingRow?.projectCount || 0);
  const editorCount = Number(deletingRow?.memberBreakdown?.editorCount || 0);
  const memberCount = Number(deletingRow?.memberBreakdown?.memberCount || 0);
  const nonAdminAffiliates = editorCount + memberCount;

  const reasons = [];
  if (projectCount > 0) reasons.push(`${projectCount} linked project(s)`);
  if (nonAdminAffiliates > 0) {
    reasons.push(`${nonAdminAffiliates} linked affiliate(s)`);
  }

  const blocked = reasons.length > 0;
  const name = String(deletingRow?.name || "").trim();
  return {
    blocked,
    confirmLabel: blocked ? "Close" : "Delete",
    message: blocked
      ? `Cannot delete "${name}". This research center has ${reasons.join(
          " and ",
        )}. Remove or reassign them first.`
      : `Delete "${name}"? This action cannot be undone.`,
  };
}
