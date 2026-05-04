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
  const normalizeText = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "-";
    const cleaned = raw.replace(/[_\s]+/g, " ").trim();
    return cleaned.replace(/\b\w/g, (match) => match.toUpperCase());
  };
  const normalizePlain = (value) => {
    const raw = String(value ?? "").trim();
    return raw || "-";
  };
  const normalizeNumber = (value, fallback = "-") => {
    if (value === null || value === undefined || value === "") return fallback;
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return String(num);
  };
  const formatPeso = (value) => {
    if (value === null || value === undefined || value === "") return "-";
    const num = Number(value);
    if (!Number.isFinite(num)) return "-";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(num) ? 0 : 2,
    }).format(num);
  };
  const normalizeLink = (value) => {
    const raw = String(value ?? "").trim();
    return raw || "-";
  };

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
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-zinc-500">
              Step 1: Project
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-zinc-700">
                  Project Title
                </span>
                <Input value={normalizePlain(form.title)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Lead Researcher
                </span>
                <Input value={normalizePlain(form.lead_researcher)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Project Year
                </span>
                <Input value={normalizeNumber(form.year)} readOnly />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-zinc-700">
                  Research Center
                </span>
                <Input value={normalizePlain(centerName)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Faculty Team
                </span>
                <Textarea
                  className="min-h-20"
                  value={normalizePlain(form.faculty_team)}
                  readOnly
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Student Team
                </span>
                <Textarea
                  className="min-h-20"
                  value={normalizePlain(form.student_team)}
                  readOnly
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-zinc-700">Abstract</span>
                <Textarea
                  className="min-h-24"
                  value={normalizePlain(form.abstract)}
                  readOnly
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-zinc-500">
              Step 2: Classification
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">Status</span>
                <Input value={normalizeText(form.status)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Classification
                </span>
                <Input value={normalizeText(form.classification)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Research Agenda
                </span>
                <Input value={normalizePlain(agendaName)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">Department</span>
                <Input value={normalizePlain(departmentName)} readOnly />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-zinc-500">
              Step 3: Funding & Timeline
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Funding Type
                </span>
                <Input value={normalizeText(form.funding_type)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Funding Source
                </span>
                <Input value={normalizePlain(form.funding_source)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Funding Amount
                </span>
                <Input value={formatPeso(form.funding_amount)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Industry/Agency Partner
                </span>
                <Input value={normalizePlain(form.industry_partner)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">
                  Signed MOA Reference
                </span>
                <Input
                  value={normalizePlain(
                    moaFile?.name || form.signed_moa_reference,
                  )}
                  readOnly
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">Start Date</span>
                <Input value={normalizePlain(form.start_date)} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-zinc-700">End Date</span>
                <Input value={normalizePlain(form.end_date)} readOnly />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-zinc-500">
              Step 4: Outputs & Visibility
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-zinc-700">
                  Expected Outputs
                </span>
                <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white p-3">
                  {expectedOutputRows.length === 0 ? (
                    <p className="text-sm text-zinc-600">-</p>
                  ) : (
                    expectedOutputRows.map((row) => (
                      <Card
                        key={`review-output-${row.client_id}`}
                        className="shadow-none"
                      >
                        <CardContent className="p-3 text-sm">
                          <p className="font-semibold text-zinc-800">
                            {EXPECTED_OUTPUT_TYPE_OPTIONS.find(
                              (item) => item.value === row.output_type,
                            )?.label || normalizeText(row.output_type)}
                          </p>
                          {String(row.specific_output || "").trim() ? (
                            <p className="text-zinc-600">
                              Specific: {normalizePlain(row.specific_output)}
                            </p>
                          ) : null}
                          {String(row.publication_authors || "").trim() ? (
                            <p className="text-zinc-600">
                              Proponents:{" "}
                              {normalizePlain(row.publication_authors)}
                            </p>
                          ) : null}
                          <p className="text-zinc-600">
                            Target: {Math.max(1, Number(row.target_count) || 1)}{" "}
                            | Notes: {normalizePlain(row.notes)}
                          </p>
                          <p className="text-zinc-600 break-all">
                            Output Link:{" "}
                            {normalizeLink(
                              row.output_link ||
                                (/^https?:\/\//i.test(
                                  String(row.file_path || "").trim(),
                                )
                                  ? row.file_path
                                  : ""),
                            )}
                          </p>
                          <p className="text-zinc-600 break-all">
                            File:{" "}
                            {normalizePlain(row.file?.name || row.file_name)}
                          </p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-zinc-700">
                  Supporting MOV Link
                </span>
                <Input
                  value={normalizeLink(form.supporting_mov_link)}
                  readOnly
                />
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
