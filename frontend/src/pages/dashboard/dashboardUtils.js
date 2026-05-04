export const ALL_VALUE = "__all__";
export const UNASSIGNED_VALUE = "__unassigned__";
export const MAX_PIE_CATEGORIES = 6;
export const MAX_BAR_LABELS = 8;
export const TOP_CENTER_ROWS = 12;

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function safeString(value) {
  return String(value ?? "").trim();
}

export function normalizeCenterId(value, knownCenterIds) {
  const raw = safeString(value);
  if (!raw) return UNASSIGNED_VALUE;
  if (raw === UNASSIGNED_VALUE) return UNASSIGNED_VALUE;
  if (knownCenterIds && knownCenterIds.has(raw)) return raw;

  const lowered = raw.toLowerCase();
  if (
    lowered === "0" ||
    lowered === "null" ||
    lowered === "undefined" ||
    lowered === "none" ||
    lowered === "n/a"
  ) {
    return UNASSIGNED_VALUE;
  }

  return raw;
}

export function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatCount(value) {
  return toNumber(value).toLocaleString();
}

export function formatCurrencyPHP(value) {
  const numericValue = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeValue);
}

export function formatDateLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date unavailable";
  return shortDateFormatter.format(d);
}

export function formatDateTimeLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date unavailable";
  return dateTimeFormatter.format(d);
}

export function formatPercentage(value, total) {
  if (!total) return "0%";
  const percent = (value / total) * 100;
  return `${percent.toFixed(1)}%`;
}

export function formatCountAndPercent(value, total) {
  return `${formatCount(value)} (${formatPercentage(value, total)})`;
}

export function parseMonthValue(raw) {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const match = String(raw).match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    return new Date(year, month, 1);
  }
  return null;
}

export function groupByQuarter(data) {
  const bucket = new Map();
  data.forEach((row) => {
    const date = parseMonthValue(row?.month);
    if (!date) return;
    const year = date.getFullYear();
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const key = `${year} Q${quarter}`;
    const existing = bucket.get(key) || { month: key, outputs: 0 };
    bucket.set(key, {
      month: key,
      outputs: existing.outputs + toNumber(row?.outputs),
    });
  });
  return Array.from(bucket.values());
}

export function resolveYearFromRecord(record) {
  const directYear = safeString(record?.year || record?.year_received);
  if (directYear && /^\d{4}$/.test(directYear)) return directYear;

  const candidates = [
    record?.submitted_at,
    record?.created_at,
    record?.updated_at,
    record?.start_date,
    record?.end_date,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
  }

  return "";
}

export function getTopIndices(data, count) {
  return data
    .map((entry, index) => ({ index, value: toNumber(entry?.value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map((entry) => entry.index);
}
