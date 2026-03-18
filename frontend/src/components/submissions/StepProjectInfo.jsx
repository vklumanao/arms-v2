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
    <div className="space-y-5">
      <div className="form-section">
        <div className="form-section-head">
          <p className="form-section-title">Basic Project Information</p>
          <p className="form-section-note">
            Start with the core project details to establish context.
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">Project title</span>
          <Input
            placeholder="e.g. AI Mentorship in Public Schools"
            required
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            className={errors?.title ? "input-error" : ""}
          />
          {errors?.title ? <p className="field-error">{errors.title}</p> : null}
          <p className="text-xs text-slate-500">
            Use a concise, descriptive title that will appear in reports.
          </p>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">
            Project abstract/summary
          </span>
          <Textarea
            placeholder="Briefly explain objectives, target beneficiaries, and expected outcomes."
            value={form.abstract}
            onChange={(e) => setField("abstract", e.target.value)}
            className={errors?.abstract ? "input-error" : ""}
          />
          {errors?.abstract ? (
            <p className="field-error">{errors.abstract}</p>
          ) : null}
        </label>
      </div>

      <div className="form-section">
        <div className="form-section-head">
          <p className="form-section-title">Research Team</p>
        </div>
        <div className="form-fields-grid form-fields-grid-2">
          <div className="lg:col-span-1">
            <UserMultiSelect
              label="Lead researcher"
              placeholder="Type a Lead Researcher name"
              searchValue={leadSearch}
              onSearchChange={setLeadSearch}
              dropdownOpen={leadDropdownOpen}
              setDropdownOpen={setLeadDropdownOpen}
              suggestions={leadSuggestions}
              onSelect={setLeadResearcherSelection}
              selections={
                selectedLeadResearcher ? [selectedLeadResearcher] : []
              }
              onRemove={() => setLeadResearcherSelection(null)}
              fieldRef={leadFieldRef}
              emptyText="No Lead Researcher selected yet."
              helperText="Type to search and select one Lead Researcher only."
              allowMultiple={false}
              error={errors?.lead_researcher}
            />
          </div>
          <div className="lg:col-span-1">
            <UserMultiSelect
              label="Research team (faculty)"
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
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold text-slate-700">
            Research team (students)
          </span>
          <Input
            placeholder="Comma-separated names (optional)"
            value={form.student_team}
            onChange={(e) => setField("student_team", e.target.value)}
          />
        </label>
      </div>

      <div className="form-section">
        <div className="form-section-head">
          <p className="form-section-title">Project Context</p>
        </div>
        <div className="form-fields-grid form-fields-grid-2">
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">Project year</span>
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
            {errors?.year ? <p className="field-error">{errors.year}</p> : null}
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-700">
              Research center
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
            {errors?.research_center_id ? (
              <p className="field-error">{errors.research_center_id}</p>
            ) : null}
          </label>
        </div>
      </div>
    </div>
  );
}
