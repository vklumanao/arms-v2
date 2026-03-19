export function isValidEmail(value) {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isLikelyUrl(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(value))
    return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(value))
    return "Password must include at least one lowercase letter.";
  if (!/\d/.test(value)) return "Password must include at least one number.";
  return "";
}
