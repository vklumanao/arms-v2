export function paginateItemsWithMeta(items, page, pageSize) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    totalPages,
    totalItems,
    start,
    end: Math.min(start + pageSize, totalItems),
    items: items.slice(start, start + pageSize),
  };
}
