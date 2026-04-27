import EmptyState from "@/components/feedback/EmptyState";
import PaginationControls from "@/components/navigation/PaginationControls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ReferenceDataGrid({
  title,
  description,
  columns,
  rows,
  rowKey,
  renderCell,
  emptyTitle,
  emptyDescription,
  page,
  totalPages,
  onPageChange,
  loading,
  minWidthClass = "min-w-[980px]",
  showSwipeHint = true,
}) {
  return (
    <Card className="overflow-hidden border border-blue-200/70 bg-white">
      <CardHeader className="border-b border-blue-200/70 bg-blue-50/25 px-4 py-4 sm:px-6 sm:py-5">
        <CardTitle className="text-base font-bold text-[#1E3A8A]">{title}</CardTitle>
        <CardDescription className="text-sm text-slate-600">{description}</CardDescription>
      </CardHeader>

      {loading ? (
        <CardContent className="p-6 text-sm text-slate-600">Loading...</CardContent>
      ) : rows.length === 0 ? (
        <CardContent className="p-6">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </CardContent>
      ) : (
        <>
          <CardContent className="p-0">
            {showSwipeHint ? (
              <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 sm:hidden">
                Swipe horizontally to view all columns.
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <Table className={minWidthClass}>
                <TableHeader>
                  <TableRow className="bg-blue-100/70">
                    {columns.map((column) => (
                      <TableHead key={column.key} className={column.headerClassName || ""}>
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={rowKey(row, index)} className="hover:bg-blue-50/80">
                      {columns.map((column) => (
                        <TableCell key={column.key} className={column.cellClassName || ""}>
                          {renderCell(column.key, row, index)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            className="border-t border-slate-200"
          />
        </>
      )}
    </Card>
  );
}
