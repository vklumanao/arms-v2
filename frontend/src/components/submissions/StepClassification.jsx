import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function StepClassification({
  form,
  setField,
  errors,
  effectiveAgendas,
  departmentName,
}) {
  return (
    <div className="form-section">
      <div className="form-section-head">
        <p className="form-section-title">Classification Details</p>
        <p className="form-section-note">
          Specify how this project should be categorized, including its type,
          priority level, and relevant classifications. This information ensures
          accurate reporting, proper routing, and efficient review by the
          appropriate teams.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-zinc-700">
              Project Classification
            </span>
            <Select
              value={form.classification || "academic"}
              onValueChange={(value) => setField("classification", value)}
            >
              <SelectTrigger
                className={errors?.classification ? "input-error" : ""}
              >
                <SelectValue placeholder="Select classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="industry">Industry</SelectItem>
                <SelectItem value="other_scholary">Other Scholarly</SelectItem>
              </SelectContent>
            </Select>
            {errors?.classification && (
              <p className="field-error">{errors.classification}</p>
            )}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-zinc-700">
              Research Agenda
            </span>
            <Select
              value={form.research_agenda_id || "__none__"}
              disabled={effectiveAgendas.length === 0}
              onValueChange={(value) =>
                setField(
                  "research_agenda_id",
                  value === "__none__" ? "" : value,
                )
              }
            >
              <SelectTrigger
                className={errors?.research_agenda_id ? "input-error" : ""}
              >
                <SelectValue placeholder="Select research agenda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select research agenda</SelectItem>
                {effectiveAgendas.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {effectiveAgendas.length === 0 && (
              <p className="text-xs text-zinc-700">
                No research agenda found in your organization custom fields.
              </p>
            )}

            {errors?.research_agenda_id && (
              <p className="field-error">{errors.research_agenda_id}</p>
            )}
          </label>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-zinc-700">Status</span>
            <Select
              value={form.status || "proposal"}
              onValueChange={(value) => setField("status", value)}
            >
              <SelectTrigger className={errors?.status ? "input-error" : ""}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="ongoing">On-going</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {errors?.status && <p className="field-error">{errors.status}</p>}
          </label>

          {departmentName && departmentName !== "-" ? (
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-zinc-700">Department</span>
              <Input
                value={departmentName}
                readOnly
                disabled
                className={errors?.department_id ? "input-error" : ""}
              />
              {errors?.department_id && (
                <p className="field-error">{errors.department_id}</p>
              )}
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}
