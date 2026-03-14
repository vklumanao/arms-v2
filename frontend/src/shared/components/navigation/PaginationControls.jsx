import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function PaginationControls({
  page,
  totalPages,
  onPageChange,
  className = "",
  showWhenSinglePage = false,
}) {
  if (!showWhenSinglePage && totalPages <= 1) return null;

  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <p className="min-w-0 text-slate-600">
          Page {page} of {totalPages}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
