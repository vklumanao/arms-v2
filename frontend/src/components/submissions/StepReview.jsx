import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EXPECTED_OUTPUT_TYPE_OPTIONS } from "@/utils/submissions";

export default function StepReview({
  form,
  centerName,
  agendaName,
  departmentName,
  expectedOutputRows,
  moaFile,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--brand-soft)] p-3 text-sm text-[var(--brand-strong)]">
        <p className="font-semibold">Final Review</p>
        <p className="mt-1">
          Review the form details below. If something is incorrect, go back and
          edit before final submission.
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
              Step 1: Project
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">
                  Project Title
                </span>
                <Input value={form.title || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Lead Researcher
                </span>
                <Input value={form.lead_researcher || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Project Year
                </span>
                <Input value={form.year || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">
                  Research Center
                </span>
                <Input value={centerName} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Faculty Team
                </span>
                <Textarea
                  className="min-h-20"
                  value={form.faculty_team || "-"}
                  readOnly
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Student Team
                </span>
                <Textarea
                  className="min-h-20"
                  value={form.student_team || "-"}
                  readOnly
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">Abstract</span>
                <Textarea
                  className="min-h-24"
                  value={form.abstract || "-"}
                  readOnly
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
              Step 2: Classification
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Status</span>
                <Input value={form.status || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Classification
                </span>
                <Input value={form.classification || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Research Agenda
                </span>
                <Input value={agendaName || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Department</span>
                <Input value={departmentName || "-"} readOnly />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
              Step 3: Funding & Timeline
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Funding Type
                </span>
                <Input value={form.funding_type || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Funding Source
                </span>
                <Input value={form.funding_source || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Funding Amount
                </span>
                <Input value={form.funding_amount || "0"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Industry/Agency Partner
                </span>
                <Input value={form.industry_partner || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Signed MOA Reference
                </span>
                <Input
                  value={moaFile?.name || form.signed_moa_reference || "-"}
                  readOnly
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Start Date</span>
                <Input value={form.start_date || "-"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">End Date</span>
                <Input value={form.end_date || "-"} readOnly />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
              Step 4: Outputs & Visibility
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">
                  Expected Outputs
                </span>
                <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3">
                  {expectedOutputRows.length === 0 ? (
                    <p className="text-sm text-slate-600">-</p>
                  ) : (
                    expectedOutputRows.map((row) => (
                      <Card
                        key={`review-output-${row.client_id}`}
                        className="shadow-none"
                      >
                        <CardContent className="p-3 text-sm">
                          <p className="font-semibold text-slate-800">
                            {EXPECTED_OUTPUT_TYPE_OPTIONS.find(
                              (item) => item.value === row.output_type,
                            )?.label ||
                              row.output_type ||
                              "-"}
                          </p>
                          {String(row.specific_output || "").trim() ? (
                            <p className="text-slate-600">
                              Specific: {row.specific_output}
                            </p>
                          ) : null}
                          {String(row.publication_authors || "").trim() ? (
                            <p className="text-slate-600">
                              Proponents: {row.publication_authors}
                            </p>
                          ) : null}
                          <p className="text-slate-600">
                            Target: {Math.max(1, Number(row.target_count) || 1)}{" "}
                            | Notes: {row.notes || "-"}
                          </p>
                          <p className="text-slate-600 break-all">
                            Output Link:{" "}
                            {row.output_link ||
                              (/^https?:\/\//i.test(
                                String(row.file_path || "").trim(),
                              )
                                ? row.file_path
                                : "-")}
                          </p>
                          <p className="text-slate-600 break-all">
                            File: {row.file?.name || row.file_name || "-"}
                          </p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">
                  Supporting MOV Link
                </span>
                <Input value={form.supporting_mov_link || "-"} readOnly />
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
