export function getActivityToneClass(tone) {
  if (tone === "warning") return "border-zinc-300 bg-zinc-50";
  if (tone === "success") return "border-zinc-300 bg-zinc-50";
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
