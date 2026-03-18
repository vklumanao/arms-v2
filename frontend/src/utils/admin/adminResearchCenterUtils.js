const CENTER_CODE_PATTERN = /^[A-Za-z0-9_]{2,24}$/;

export function validateCenterForm({ name, code, centerChiefId, researchAgendas }) {
  const errors = {};
  const trimmedName = String(name || "").trim();
  const trimmedCode = String(code || "").trim();
  const agendas = Array.isArray(researchAgendas) ? researchAgendas : [];

  if (!trimmedName) {
    errors.name = "Research center name is required.";
  } else if (trimmedName.length < 2) {
    errors.name = "Research center name must be at least 2 characters.";
  }

  if (!trimmedCode) {
    errors.code = "Research center code is required.";
  } else if (!CENTER_CODE_PATTERN.test(trimmedCode)) {
    errors.code =
      "Research center code must be 2-24 chars (letters, numbers, underscore).";
  }

  if (!String(centerChiefId || "").trim()) {
    errors.centerChiefId = "Center chief is required.";
  }

  if (!agendas.length) {
    errors.researchAgendas = "Add at least one research agendum.";
  }

  return errors;
}

export function getOrgExtra(org, key) {
  const extras = Array.isArray(org?.extras) ? org.extras : [];
  const found = extras.find(
    (item) =>
      String(item?.key || "")
        .trim()
        .toLowerCase() ===
      String(key || "")
        .trim()
        .toLowerCase(),
  );
  return found?.value || "";
}
