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
}) {
  return (
    <Card className="overflow-hidden border border-slate-200 bg-white">
      <CardHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5">
        <CardTitle className="text-base font-bold text-[#1E293B]">
          {title}
        </CardTitle>
        <CardDescription className="text-sm text-slate-600">
          {description}
        </CardDescription>
      </CardHeader>

      {loading ? (
        <CardContent className="p-6 text-sm text-slate-600">
          Loading...
        </CardContent>
      ) : rows.length === 0 ? (
        <CardContent className="p-6">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </CardContent>
      ) : (
        <>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className={minWidthClass}>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    {columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className={column.headerClassName || ""}
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow
                      key={rowKey(row, index)}
                      className="hover:bg-slate-50"
                    >
                      {columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={column.cellClassName || ""}
                        >
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
