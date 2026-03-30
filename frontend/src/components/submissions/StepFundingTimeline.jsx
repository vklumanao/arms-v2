import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function StepFundingTimeline({
  form,
  setField,
  errors,
  sanitizeDecimal,
  moaFile,
  setMoaFile,
  setError,
  formatFileSize,
  maxMoaFileSizeBytes,
}) {
  const formatFundingAmount = (value) => {
    if (value === null || value === undefined || value === "") return "";
    const raw = String(value);
    const [integerPart, decimalPart] = raw.split(".");
    const normalizedInteger = integerPart.replace(/\D/g, "");
    const formattedInteger = normalizedInteger.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ",",
    );
    if (decimalPart !== undefined) {
      return `${formattedInteger}.${decimalPart}`;
    }
    return formattedInteger;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div className="form-section">
          <div className="form-section-head">
            <p className="form-section-title">Funding Details</p>
            <p className="form-section-note">
              Provide comprehensive funding information, including budget
              amounts, funding sources, and allocation details. Accurate entries
              ensure proper financial tracking, transparency, and accountability
              throughout the project.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Funding Type</span>
              <Select
                value={form.funding_type || "internal"}
                onValueChange={(value) => setField("funding_type", value)}
              >
                <SelectTrigger
                  className={errors?.funding_type ? "input-error" : ""}
                >
                  <SelectValue placeholder="Select funding type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="self_funded">Self Funded</SelectItem>
                </SelectContent>
              </Select>
              {errors?.funding_type && (
                <p className="field-error">{errors.funding_type}</p>
              )}
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">
                Funding Source
              </span>
              <Input
                placeholder="e.g. ARMS Grants Office"
                value={form.funding_source}
                onChange={(e) => setField("funding_source", e.target.value)}
                className={errors?.funding_source ? "input-error" : ""}
              />
              {errors?.funding_source && (
                <p className="field-error">{errors.funding_source}</p>
              )}
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">
                Funding Amount
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-500">
                  ₱
                </span>
                <Input
                  placeholder="e.g. 50,000"
                  type="text"
                  inputMode="decimal"
                  value={formatFundingAmount(form.funding_amount)}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    const sanitizedValue = sanitizeDecimal(
                      rawValue.replace(/,/g, ""),
                    );
                    setField("funding_amount", sanitizedValue);
                  }}
                  className={`${
                    errors?.funding_amount ? "input-error" : ""
                  } pl-7`}
                />
              </div>
              {errors?.funding_amount && (
                <p className="field-error">{errors.funding_amount}</p>
              )}
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="form-section">
          <div className="form-section-head">
            <p className="form-section-title">MOA and Timeline</p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">
                Industry/Agency partner
              </span>
              <Input
                placeholder="e.g. PNP, DA-BAFE"
                value={form.industry_partner}
                onChange={(e) => setField("industry_partner", e.target.value)}
                className={errors?.industry_partner ? "input-error" : ""}
              />
              {errors?.industry_partner && (
                <p className="field-error">{errors.industry_partner}</p>
              )}
            </label>

            <div className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Signed MOA</span>

              <div className="upload-field">
                <div className="upload-picker">
                  <div className="upload-picker-info">
                    <FileText size={16} className="mt-0.5 text-slate-500" />
                    <div className="space-y-0.5">
                      <p className="upload-picker-name">
                        {moaFile?.name || "No file selected"}
                      </p>
                      <p className="upload-picker-sub">
                        Size: {formatFileSize(moaFile?.size)}
                      </p>
                    </div>
                  </div>

                  <Button asChild variant="outline" className="upload-trigger">
                    <label>
                      <Upload size={14} />
                      <span>{moaFile ? "Replace" : "Choose File"}</span>
                      <input
                        className="sr-only"
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const nextFile = e.target.files?.[0] || null;
                          if (!nextFile) {
                            setMoaFile(null);
                            return;
                          }
                          if (nextFile.size > maxMoaFileSizeBytes) {
                            setError("MOA file must be 25MB or smaller.");
                            e.target.value = "";
                            return;
                          }
                          setError("");
                          setMoaFile(nextFile);
                        }}
                      />
                    </label>
                  </Button>
                </div>

                <div className="upload-field-preview">
                  <p className="upload-field-preview-text">
                    Current reference: {form.signed_moa_reference || "-"}
                  </p>
                  <p className="upload-field-hint">
                    Allowed: PDF, DOC, XLS, PNG, JPG | Max 25MB
                  </p>
                  <p className="text-xs text-slate-600">
                    Upload is saved when you submit/save revision.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Start Date</span>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setField("start_date", e.target.value)}
                  className={errors?.start_date ? "input-error" : ""}
                />
                {errors?.start_date && (
                  <p className="field-error">{errors.start_date}</p>
                )}
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-slate-700">End Date</span>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setField("end_date", e.target.value)}
                  className={errors?.end_date ? "input-error" : ""}
                />
                {errors?.end_date && (
                  <p className="field-error">{errors.end_date}</p>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
