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
  return (
    <div className="space-y-5">
      <div className="form-section">
        <div className="form-section-head">
          <p className="form-section-title">Funding Details</p>
          <p className="form-section-note">
            Enter funding values and source details as accurately as possible.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Funding type</span>
            <Select
              value={form.funding_type || "none"}
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
            {errors?.funding_type ? (
              <p className="field-error">{errors.funding_type}</p>
            ) : null}
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Funding source</span>
            <Input
              placeholder="e.g. ARMS Grants Office"
              value={form.funding_source}
              onChange={(e) => setField("funding_source", e.target.value)}
              className={errors?.funding_source ? "input-error" : ""}
            />
            {errors?.funding_source ? (
              <p className="field-error">{errors.funding_source}</p>
            ) : null}
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Funding amount</span>
            <Input
              placeholder="e.g. 50000"
              type="number"
              min="0"
              inputMode="decimal"
              step="0.01"
              value={form.funding_amount}
              onChange={(e) =>
                setField("funding_amount", sanitizeDecimal(e.target.value))
              }
              className={errors?.funding_amount ? "input-error" : ""}
            />
            {errors?.funding_amount ? (
              <p className="field-error">{errors.funding_amount}</p>
            ) : null}
          </label>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-head">
          <p className="form-section-title">MOA and Timeline</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
            {errors?.industry_partner ? (
              <p className="field-error">{errors.industry_partner}</p>
            ) : null}
          </label>
          <div className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">
              Signed MOA reference
            </span>
            <div className="upload-field">
              <div className="upload-picker">
                <div className="upload-picker-info">
                  <FileText
                    size={16}
                    className="mt-0.5 text-slate-500"
                    aria-hidden="true"
                  />
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
                    <Upload size={14} aria-hidden="true" />
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Start date</span>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setField("start_date", e.target.value)}
              className={errors?.start_date ? "input-error" : ""}
            />
            {errors?.start_date ? (
              <p className="field-error">{errors.start_date}</p>
            ) : null}
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">
              End date (due date)
            </span>
            <Input
              type="date"
              value={form.end_date}
              onChange={(e) => setField("end_date", e.target.value)}
              className={errors?.end_date ? "input-error" : ""}
            />
            {errors?.end_date ? (
              <p className="field-error">{errors.end_date}</p>
            ) : null}
          </label>
        </div>
      </div>
    </div>
  );
}
