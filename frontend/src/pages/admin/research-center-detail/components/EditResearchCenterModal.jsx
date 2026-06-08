import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

export default function EditResearchCenterModal({
  open,
  onOpenChange,
  editForm,
  updateEditForm,
  editErrors,
  isEditValid,
  chiefUsers,
  addEditAgenda,
  removeEditAgenda,
  saveCenter,
  editSaving,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !editSaving && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-4xl">
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
            <DialogTitle>Edit Research Center</DialogTitle>
            <DialogDescription>
              Update research center information.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
            <div className="rounded-xl border bg-white p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Basic Information
              </p>

              <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Name</span>
                  <Input
                    value={editForm.name}
                    onChange={(event) =>
                      updateEditForm({ name: event.target.value })
                    }
                  />
                  {editErrors.name ? (
                    <p className="field-error">{editErrors.name}</p>
                  ) : null}
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">Code</span>
                  <Input
                    value={editForm.code}
                    onChange={(event) =>
                      updateEditForm({ code: event.target.value })
                    }
                  />
                  {editErrors.code ? (
                    <p className="field-error">{editErrors.code}</p>
                  ) : null}
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Center Chief
                  </span>

                  <Select
                    value={String(editForm.centerChiefId || "")}
                    onValueChange={(value) =>
                      updateEditForm({ centerChiefId: value })
                    }
                  >
                    <SelectTrigger
                      className={editErrors.centerChiefId ? "input-error" : ""}
                    >
                      <SelectValue placeholder="Select center chief" />
                    </SelectTrigger>

                    <SelectContent>
                      {chiefUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {editErrors.centerChiefId ? (
                    <p className="field-error">{editErrors.centerChiefId}</p>
                  ) : null}
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Social Media Link
                  </span>

                  <Input
                    value={editForm.socialMediaLink}
                    onChange={(event) =>
                      updateEditForm({
                        socialMediaLink: event.target.value,
                      })
                    }
                    placeholder="https://facebook.com/your-center"
                  />
                </label>

                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-semibold text-slate-700">
                    Description
                  </span>

                  <Textarea
                    value={editForm.description}
                    onChange={(event) =>
                      updateEditForm({
                        description: event.target.value,
                      })
                    }
                    rows={4}
                    placeholder="Optional short description..."
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Research Agendas
              </p>

              <div className="flex flex-wrap gap-2">
                {editForm.researchAgendas.map((agenda) => (
                  <button
                    key={agenda}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-muted"
                    onClick={() => removeEditAgenda(agenda)}
                  >
                    <span className="truncate">{agenda}</span>
                    <X className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                ))}

                {editForm.researchAgendas.length === 0 ? (
                  <p className="text-xs text-slate-500">No agendas yet.</p>
                ) : null}
              </div>

              {editErrors.researchAgendas ? (
                <p className="field-error">{editErrors.researchAgendas}</p>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Add research agendum"
                  value={editForm.agendaInput}
                  onChange={(event) =>
                    updateEditForm({
                      agendaInput: event.target.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addEditAgenda();
                  }}
                />

                <Button type="button" variant="outline" onClick={addEditAgenda}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 sm:px-6">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={editSaving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={editSaving || !isEditValid}
                onClick={saveCenter}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
