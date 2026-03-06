export function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function daysSince(dateLike) {
  const ts = new Date(dateLike || 0).getTime();
  if (!ts) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((now - ts) / (1000 * 60 * 60 * 24)));
}

export function dueWithinDays(endDate, days = 14) {
  if (!endDate) return false;
  const due = new Date(endDate).getTime();
  if (!due) return false;
  const diff = Math.ceil((due - Date.now()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= days;
}

export function toMapById(rows, key = "id") {
  return (rows || []).reduce((acc, row) => {
    acc[row[key]] = row;
    return acc;
  }, {});
}

export function isMissingAbstract(item) {
  return !String(item?.abstract || "").trim();
}

export function hasInvalidDates(item) {
  if (!item?.start_date || !item?.end_date) return false;
  const start = new Date(item.start_date);
  const end = new Date(item.end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
  return start > end;
}

export function getDiffRows(oldValues, newValues) {
  const keys = [
    "title",
    "abstract",
    "year",
    "status",
    "start_date",
    "end_date",
    "expected_outputs",
    "funding_source",
    "funding_amount",
  ];
  return keys
    .filter((key) => (oldValues?.[key] ?? null) !== (newValues?.[key] ?? null))
    .map((key) => ({
      key,
      oldValue: oldValues?.[key] ?? "-",
      newValue: newValues?.[key] ?? "-",
    }));
}

