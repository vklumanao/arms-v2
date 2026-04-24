import { EMPTY_EDITING, SOCIAL_MEDIA_OPTIONS } from "./constants";

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
