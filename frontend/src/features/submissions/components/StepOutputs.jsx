import { Button } from "@/components/ui/button";
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
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import { EXPECTED_OUTPUT_TYPE_OPTIONS } from "@/features/submissions/utils";

export default function StepOutputs({
  expectedOutputRows,
  paginatedExpectedOutputRows,
  expectedOutputsPage,
  expectedOutputsTotalPages,
  setExpectedOutputsPage,
  openAddOutputModal,
  openEditOutputModal,
  deleteExpectedOutputRow,
  form,
  setField,
  errors,
}) {
  return (
    <div className="space-y-5">
      <Card className="bg-muted/30 shadow-none">
        <CardContent className="p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Submission checklist</p>
          <ul className="mt-1 list-disc pl-4">
            <li>Title and center are filled.</li>
            <li>Classification and year are valid.</li>
            <li>Dates and funding values are logically consistent.</li>
          </ul>
        </CardContent>
      </Card>

      <div className="form-section">
        <div className="form-section-head">
          <p className="form-section-title">Outputs and Resources</p>
          <p className="form-section-note">
            Optional step: add outputs now, or add them later in Research
            Outputs.
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">
              Expected research outputs
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={openAddOutputModal}
            >
              Add Output
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Rows are finalized in database when you submit/save revision.
          </p>
          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white">
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Output Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expectedOutputRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="px-3 py-4 text-center text-xs text-slate-500"
                    >
                      No expected outputs added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedExpectedOutputRows.map((row) => (
                    <TableRow key={row.client_id}>
                      <TableCell>
                        {EXPECTED_OUTPUT_TYPE_OPTIONS.find(
                          (item) => item.value === row.output_type,
                        )?.label ||
                          row.output_type ||
                          "-"}
                        {String(row.specific_output || "").trim() ? (
                          <p className="text-xs text-slate-500">
                            Specific: {row.specific_output}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {Math.max(1, Number(row.target_count) || 1)}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {row.notes || "-"}
                        {row.needs_file_reselect ? (
                          <p className="text-xs text-amber-700">
                            File needs re-attach after refresh.
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="break-all text-slate-600">
                        {row.file_name ||
                          row.file?.name ||
                          row.file_path ||
                          "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openEditOutputModal(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              deleteExpectedOutputRow(row.client_id)
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {errors?.expected_outputs ? (
            <p className="field-error">{errors.expected_outputs}</p>
          ) : null}
          {expectedOutputRows.length > 0 ? (
            <PaginationControls
              page={expectedOutputsPage}
              totalPages={expectedOutputsTotalPages}
              onPageChange={setExpectedOutputsPage}
            />
          ) : null}
        </div>
        <label className="block space-y-1 text-sm sm:max-w-2xl">
          <span className="font-semibold text-slate-700">
            Supporting MOV link (optional)
          </span>
          <Input
            placeholder="Google Drive link or repository of supporting MOVs"
            value={form.supporting_mov_link}
            onChange={(e) => setField("supporting_mov_link", e.target.value)}
          />
        </label>
        <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3 text-sm sm:max-w-2xl">
          <input
            className="mt-1 h-4 w-4"
            type="checkbox"
            checked={Boolean(form.public_visible)}
            onChange={(e) => setField("public_visible", e.target.checked)}
          />
          <span className="space-y-1">
            <span className="block font-semibold text-slate-700">
              Make project publicly visible after submission
            </span>
            <span className="block text-xs text-slate-500">
              Turn this on if the dataset can be visible outside your private
              workspace.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
