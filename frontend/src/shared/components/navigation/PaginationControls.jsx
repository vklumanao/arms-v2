export default function PaginationControls({
  page,
  totalPages,
  onPageChange,
  className = "",
  showWhenSinglePage = false,
}) {
  if (!showWhenSinglePage && totalPages <= 1) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm ${className}`.trim()}
    >
      <p className="min-w-0 text-slate-600">
        Page {page} of {totalPages}
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

