import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PaginationControls from "@/components/navigation/PaginationControls";
import { EXPECTED_OUTPUT_TYPE_OPTIONS } from "@/utils/submissions";

export default function StepOutputs({
  expectedOutputRows,
  paginatedExpectedOutputRows,
  expectedOutputsPage,
  expectedOutputsTotalPages,
  setExpectedOutputsPage,
  expectedOutputsPageSize,
  onReorderExpectedOutputs,
  onQuickAddOutput,
  openAddOutputModal,
  openEditOutputModal,
  deleteExpectedOutputRow,
  form,
  setField,
  errors,
}) {
  const pageStart =
    (expectedOutputsPage - 1) * (Number(expectedOutputsPageSize) || 10);
  const handleDrop = (fromIndex, toIndex) => {
    if (!onReorderExpectedOutputs) return;
    if (fromIndex === toIndex) return;
    onReorderExpectedOutputs(fromIndex, toIndex);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2">
        <div className="form-section">
          <div className="form-section-head">
            <p className="form-section-title">Outputs and Resources</p>
            <p className="form-section-note">
              Add expected project outputs and required resources, such as
              deliverables, materials, or supporting assets. This step is
              optional—you may complete it now or provide these details later in
              the Research Outputs section.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">
                Expected research outputs
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold uppercase tracking-[0.08em] text-slate-500">
                Quick add:
              </span>

              <div className="min-w-[220px]">
                <Select
                  value="__none__"
                  onValueChange={(value) => {
                    if (value === "__none__") return;
                    onQuickAddOutput?.(value);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select output type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select output type</SelectItem>
                    {EXPECTED_OUTPUT_TYPE_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Rows are finalized in database when you submit/save revision.
            </p>

            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[44px]" />
                    <TableHead>Output Type</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Output Link</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {expectedOutputRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="px-3 py-4 text-center text-xs text-slate-500"
                      >
                        No expected outputs added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedExpectedOutputRows.map((row, pageIndex) => {
                      const globalIndex = pageStart + pageIndex;

                      return (
                        <TableRow
                          key={row.client_id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData(
                              "text/plain",
                              String(globalIndex),
                            );
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            const fromIndex = Number(
                              event.dataTransfer.getData("text/plain"),
                            );
                            if (!Number.isFinite(fromIndex)) return;
                            handleDrop(fromIndex, globalIndex);
                          }}
                          className="cursor-move"
                        >
                          <TableCell className="text-slate-400">
                            <GripVertical className="h-4 w-4" />
                          </TableCell>

                          <TableCell>
                            {EXPECTED_OUTPUT_TYPE_OPTIONS.find(
                              (item) => item.value === row.output_type,
                            )?.label ||
                              row.output_type ||
                              "-"}

                            {row.specific_output && (
                              <p className="text-xs text-slate-500">
                                Specific: {row.specific_output}
                              </p>
                            )}

                            {row.publication_authors && (
                              <p className="text-xs text-slate-500">
                                Proponents: {row.publication_authors}
                              </p>
                            )}
                          </TableCell>

                          <TableCell className="text-slate-600">
                            {row.notes || "-"}
                          </TableCell>

                          <TableCell className="break-all text-slate-600">
                            {row.output_link ? (
                              <a
                                href={row.output_link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {row.output_link}
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>

                          <TableCell className="break-all text-slate-600">
                            {row.file_name || row.file?.name || "-"}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditOutputModal(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  deleteExpectedOutputRow(row.client_id)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {errors?.expected_outputs && (
              <p className="field-error">{errors.expected_outputs}</p>
            )}

            {expectedOutputRows.length > 0 && (
              <PaginationControls
                page={expectedOutputsPage}
                totalPages={expectedOutputsTotalPages}
                onPageChange={setExpectedOutputsPage}
              />
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 lg:max-w-2xl">
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">
            Other Documents (optional)
          </span>
          <Input
            placeholder="Google Drive link or repository of supporting MOVs"
            value={form.supporting_mov_link}
            onChange={(e) => setField("supporting_mov_link", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
