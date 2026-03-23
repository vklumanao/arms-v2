import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import UserMultiSelect from "@/components/submissions/UserMultiSelect";

export default function StepProjectInfo({
  form,
  setField,
  errors,
  leadSearch,
  setLeadSearch,
  leadDropdownOpen,
  setLeadDropdownOpen,
  leadSuggestions,
  setLeadResearcherSelection,
  selectedLeadResearcher,
  leadFieldRef,
  facultySearch,
  setFacultySearch,
  facultyDropdownOpen,
  setFacultyDropdownOpen,
  facultySuggestions,
  addProponentSelection,
  facultyTeamSelections,
  removeProponentSelection,
  facultyFieldRef,
  sanitizeDigits,
  centerName,
  profileOrgId,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div className="form-section">
          <div className="form-section-head">
            <p className="form-section-title">Basic Project Information</p>
            <p className="form-section-note">
              Start with the core project details to establish context.
            </p>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Project Title</span>
            <Input
              placeholder="e.g. AI Mentorship in Public Schools"
              required
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              className={errors?.title ? "input-error" : ""}
            />
            {errors?.title && <p className="field-error">{errors.title}</p>}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">
              Project Summary
            </span>
            <Textarea
              placeholder="Briefly explain objectives, target beneficiaries, and expected outcomes."
              value={form.abstract}
              onChange={(e) => setField("abstract", e.target.value)}
              className={errors?.abstract ? "input-error" : ""}
            />
            {errors?.abstract && (
              <p className="field-error">{errors.abstract}</p>
            )}
          </label>
        </div>

        <div className="form-section">
          <div className="form-section-head">
            <p className="form-section-title">Project Context</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">Project Year</span>
              <Input
                type="number"
                min="2000"
                max="2100"
                inputMode="numeric"
                placeholder="e.g. 2026"
                required
                value={form.year}
                onChange={(e) =>
                  setField("year", sanitizeDigits(e.target.value, 4))
                }
                className={errors?.year ? "input-error" : ""}
              />
              {errors?.year && <p className="field-error">{errors.year}</p>}
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">
                Research Center
              </span>
              <Input
                value={
                  centerName === "-"
                    ? form.research_center_id || profileOrgId || ""
                    : centerName
                }
                readOnly
                disabled
                className={errors?.research_center_id ? "input-error" : ""}
              />
              {errors?.research_center_id && (
                <p className="field-error">{errors.research_center_id}</p>
              )}
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="form-section">
          <div className="form-section-head">
            <p className="form-section-title">Research Team</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-700">
                Lead Researcher
              </span>
              <Input
                value={selectedLeadResearcher || form.lead_researcher || ""}
                readOnly
                disabled
                className={errors?.lead_researcher ? "input-error" : ""}
              />
              {errors?.lead_researcher && (
                <p className="field-error">{errors.lead_researcher}</p>
              )}
            </label>

            <UserMultiSelect
              label="Research Team (Faculty)"
              placeholder="Type a Faculty name"
              searchValue={facultySearch}
              onSearchChange={setFacultySearch}
              dropdownOpen={facultyDropdownOpen}
              setDropdownOpen={setFacultyDropdownOpen}
              suggestions={facultySuggestions}
              onSelect={(user) => addProponentSelection("faculty_team", user)}
              selections={facultyTeamSelections}
              onRemove={(name) =>
                removeProponentSelection("faculty_team", name)
              }
              fieldRef={facultyFieldRef}
              emptyText="No Faculty selected yet."
              helperText="Type to search and select one or more Faculty."
              error={errors?.faculty_team}
            />
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">
              Research Team (Students)
            </span>
            <Input
              placeholder="Comma-separated names (optional)"
              value={form.student_team}
              onChange={(e) => setField("student_team", e.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
