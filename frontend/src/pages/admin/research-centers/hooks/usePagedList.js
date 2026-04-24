import { useEffect, useMemo, useState } from "react";

export default function usePagedList({
  totalItems,
  pageSize,
  resetKeys = [],
  initialPage = 1,
}) {
  const [page, setPage] = useState(initialPage);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(Number(totalItems || 0) / pageSize)),
    [pageSize, totalItems],
  );

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage, ...resetKeys]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (page - 1) * pageSize;

  return {
    page,
    setPage,
    totalPages,
    start,
  };
}
