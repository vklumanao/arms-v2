export function toDisplayFirstName(profile, email = "") {
  const fullName = String(profile?.full_name || "").trim();
  if (fullName) {
    if (fullName.includes(",")) {
      const [, givenPart = ""] = fullName.split(",", 2);
      const first = givenPart.trim().split(/\s+/)[0] || "";
      if (first) return first;
    }
    const first = fullName.split(/\s+/)[0] || "";
    if (first) return first;
  }

  const emailUser = String(email || "")
    .trim()
    .split("@")[0]
    ?.split(/[._-]+/)[0];
  if (emailUser) {
    return emailUser.charAt(0).toUpperCase() + emailUser.slice(1);
  }

  return "User";
}
