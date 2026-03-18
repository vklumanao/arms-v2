export function getActivityToneClass(tone) {
  if (tone === "warning") return "border-amber-300 bg-amber-50";
  if (tone === "success") return "border-emerald-300 bg-emerald-50";
  return "border-[var(--border)] bg-white";
}

export function paginateItems(items, page, pageSize) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}
