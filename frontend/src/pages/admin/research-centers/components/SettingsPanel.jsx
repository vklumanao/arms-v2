import { Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default function SettingsPanel({
  center,
  editing,
  editErrors,
  editLoading,
  actionLoading,
  isEditFormValid,
  centerChiefUsers,
  onChange,
  onAddAgenda,
  onRemoveAgenda,
  onCancel,
  onSave,
  onDelete,
}) {
  const isReady = editing.id && editing.id === center.id;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="space-y-1 border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
          <CardTitle className="text-lg font-bold text-slate-700">
            Workspace Settings
          </CardTitle>
          <CardDescription>
            Edit this center inline without leaving the workspace. Changes save
            directly to the registry.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {editLoading || !isReady ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 rounded-2xl bg-slate-200" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-32 rounded-[1.3rem] bg-slate-200" />
                <div className="h-32 rounded-[1.3rem] bg-slate-200" />
              </div>
              <div className="h-32 rounded-[1.3rem] bg-slate-200" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                    Identity
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Research Center Name *
                      </label>
                      <Input
                        className={cn(
                          "h-11 rounded-2xl border bg-white",
                          editErrors.name
                            ? "border-[#F97316]"
                            : "border-slate-300",
                        )}
                        value={editing.name}
                        onChange={(event) =>
                          onChange({ name: event.target.value })
                        }
                      />
                      {editErrors.name ? (
                        <p className="text-xs text-slate-800">
                          {editErrors.name}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Code *
                      </label>
                      <Input
                        className={cn(
                          "h-11 rounded-2xl border bg-white",
                          editErrors.code
                            ? "border-[#F97316]"
                            : "border-slate-300",
                        )}
                        value={editing.code}
                        onChange={(event) =>
                          onChange({
                            code: event.target.value
                              .toUpperCase()
                              .replace(/\s+/g, "_"),
                          })
                        }
                      />
                      {editErrors.code ? (
                        <p className="text-xs text-slate-800">
                          {editErrors.code}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Center Chief *
                      </label>
                      <Select
                        value={editing.centerChiefId}
                        onValueChange={(value) =>
                          onChange({ centerChiefId: value })
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-11 rounded-2xl border bg-white",
                            editErrors.centerChiefId
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
                      {editErrors.centerChiefId ? (
                        <p className="text-xs text-slate-800">
                          {editErrors.centerChiefId}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                    Public Presence
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Social Media
                      </label>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Select
                          value={editing.socialMediaPlatform}
                          onValueChange={(value) =>
                            onChange({ socialMediaPlatform: value })
                          }
                        >
                          <SelectTrigger className="h-11 rounded-2xl border border-slate-300 bg-white">
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                          <SelectContent className="border border-slate-300 bg-white">
                            {SOCIAL_MEDIA_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="sm:col-span-2">
                          <Input
                            className="h-11 rounded-2xl border border-slate-300 bg-white"
                            value={editing.socialMediaLink}
                            placeholder={getSocialPlaceholder(
                              editing.socialMediaPlatform,
                            )}
                            onChange={(event) =>
                              onChange({ socialMediaLink: event.target.value })
                            }
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        Displayed on the center detail page if provided.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Description
                      </label>
                      <Textarea
                        className="min-h-[180px] rounded-[1.1rem] border border-slate-300 bg-white"
                        value={editing.description}
                        placeholder="Add a positioning statement, mission, or quick summary..."
                        onChange={(event) =>
                          onChange({ description: event.target.value })
                        }
                      />
                      <p className="text-xs text-slate-500">
                        A short summary helps the center feel complete in the
                        admin and public views.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
                  Research Agendas
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      className={cn(
                        "h-11 rounded-2xl border bg-white",
                        editErrors.researchAgendas
                          ? "border-[#F97316]"
                          : "border-slate-300",
                      )}
                      placeholder="Add research agendum"
                      value={editing.agendaInput}
                      onChange={(event) =>
                        onChange({ agendaInput: event.target.value })
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
                      Add Agenda
                    </Button>
                  </div>

                  {editing.researchAgendas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {editing.researchAgendas.map((agenda) => (
                        <button
                          key={agenda}
                          type="button"
                          className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          onClick={() => onRemoveAgenda(agenda)}
                        >
                          {agenda} ×
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Add at least one agenda to keep the center discoverable
                      across the registry.
                    </p>
                  )}

                  {editErrors.researchAgendas ? (
                    <p className="text-xs text-slate-800">
                      {editErrors.researchAgendas}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-100 bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Inline changes are ready to save.
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Use Cancel to reload the latest saved values for this
                    center.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                    onClick={onCancel}
                    disabled={actionLoading}
                  >
                    Reset Form
                  </Button>
                  <Button
                    className="bg-[#10B981] text-white hover:bg-[#059669]"
                    onClick={onSave}
                    disabled={actionLoading || !isEditFormValid}
                  >
                    {actionLoading ? "Saving..." : "Save Inline Changes"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-orange-200 shadow-sm">
        <CardHeader className="space-y-1 border-b border-orange-100 bg-orange-50/60 px-4 py-4 sm:px-6 sm:py-5">
          <CardTitle className="text-lg font-bold text-orange-700">
            Danger Zone
          </CardTitle>
          <CardDescription>
            Delete this research center once its linked projects and affiliates
            have been cleared.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            This action is permanent and follows the existing delete safeguards.
          </div>
          <Button
            variant="outline"
            className="border-orange-200 text-orange-700 hover:bg-orange-50"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete Research Center
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
