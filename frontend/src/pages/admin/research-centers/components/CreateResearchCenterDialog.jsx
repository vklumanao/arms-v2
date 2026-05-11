import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOCIAL_MEDIA_OPTIONS } from "../constants";
import { getSocialPlaceholder } from "../helpers";

export default function CreateResearchCenterDialog({
  open,
  onOpenChange,
  centerChiefUsers,
  values,
  errors,
  loading,
  isValid,
  onFieldChange,
  onAddAgenda,
  onRemoveAgenda,
  onSubmit,
}) {
  return open ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mx-auto max-w-3xl border border-slate-300 bg-white text-slate-700 shadow-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-700">
            Create Research Center
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Add a new research center to the registry.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Research Center Name *
            </label>
            <Input
              className={cn(
                "border bg-white",
                errors.name ? "border-[#F97316]" : "border-slate-300",
              )}
              placeholder="e.g., Center for Data Science and AI"
              value={values.name}
              onChange={(event) => onFieldChange({ name: event.target.value })}
            />
            {errors.name ? (
              <p className="text-xs text-slate-800">{errors.name}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Code *
            </label>
            <Input
              className={cn(
                "border bg-white",
                errors.code ? "border-[#F97316]" : "border-slate-300",
              )}
              placeholder="e.g., CDSAI"
              value={values.code}
              onChange={(event) =>
                onFieldChange({
                  code: event.target.value.toUpperCase().replace(/\s+/g, "_"),
                })
              }
            />
            {errors.code ? (
              <p className="text-xs text-slate-800">{errors.code}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Center Chief *
            </label>
            <Select
              value={values.centerChiefId}
              onValueChange={(value) => onFieldChange({ centerChiefId: value })}
            >
              <SelectTrigger
                className={cn(
                  "border bg-white",
                  errors.centerChiefId
                    ? "border-[#F97316]"
                    : "border-slate-300",
                )}
              >
                <SelectValue placeholder="Select Center Chief" />
              </SelectTrigger>
              <SelectContent className="border border-slate-300 bg-white">
                {centerChiefUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.centerChiefId ? (
              <p className="text-xs text-slate-800">{errors.centerChiefId}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Social Media
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Select
                value={values.socialMediaPlatform}
                onValueChange={(value) =>
                  onFieldChange({ socialMediaPlatform: value })
                }
              >
                <SelectTrigger className="border border-slate-300 bg-white">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent className="border border-slate-300 bg-white">
                  {SOCIAL_MEDIA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="sm:col-span-2">
                <Input
                  className="border border-slate-300 bg-white"
                  value={values.socialMediaLink}
                  placeholder={getSocialPlaceholder(values.socialMediaPlatform)}
                  onChange={(event) =>
                    onFieldChange({ socialMediaLink: event.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Description
            </label>
            <Textarea
              className="border border-slate-300 bg-white"
              placeholder="Write a short overview, mission, or focus of this research center..."
              value={values.description}
              onChange={(event) =>
                onFieldChange({ description: event.target.value })
              }
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Research Agendum *
            </label>
            <div className="flex gap-2">
              <Input
                className={cn(
                  "border bg-white",
                  errors.researchAgendas
                    ? "border-[#F97316]"
                    : "border-slate-300",
                )}
                placeholder="e.g., Smart Agriculture"
                value={values.agendaInput}
                onChange={(event) =>
                  onFieldChange({ agendaInput: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onAddAgenda();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={onAddAgenda}
              >
                Add
              </Button>
            </div>
            {values.researchAgendas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {values.researchAgendas.map((agenda) => (
                  <button
                    key={agenda}
                    type="button"
                    className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs hover:bg-slate-100"
                    onClick={() => onRemoveAgenda(agenda)}
                  >
                    {agenda} ×
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Add at least one agenda.
              </p>
            )}
            {errors.researchAgendas ? (
              <p className="text-xs text-slate-800">
                {errors.researchAgendas}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="bg-[#10B981] text-white hover:bg-[#059669]"
            onClick={onSubmit}
            disabled={loading || !isValid}
          >
            {loading ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;
}

