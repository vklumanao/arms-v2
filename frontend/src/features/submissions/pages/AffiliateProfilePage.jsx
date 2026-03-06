import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useReferenceData } from "@/shared/hooks/useReferenceData";
import { isLikelyUrl } from "@/shared/utils/validation";
import {
  fetchAffiliateProfile,
  updateAffiliateProfile as updateAffiliateProfileService,
} from "@/features/submissions/services";
import PageHeader from "@/shared/components/layout/PageHeader";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import { useToast } from "@/app/providers/ToastProvider";

const INITIAL_FORM = {
  full_name: "",
  department: "",
  ckan_org_id: "",
  google_scholar_link: "",
  employment_status: "",
  designation: "",
  is_gs_faculty: false,
  publication_count: 0,
  research_project_count: 0,
  creative_work_count: 0,
  awards_count: 0,
  ip_count: 0,
};

export default function AffiliateProfilePage() {
  const { user, profile } = useAuth();
  const { centers, error: referenceError } = useReferenceData();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmSave, setConfirmSave] = useState(false);
  const toast = useToast();
  const centerNameById = useMemo(() => {
    const map = {};
    (centers || []).forEach((center) => {
      map[center.id] = center.name;
    });
    return map;
  }, [centers]);

  useEffect(() => {
    if (!user?.id) return;
    fetchAffiliateProfile().then((profileRes) => {
      if (profileRes.data) {
        setForm({
          ...INITIAL_FORM,
          ...profileRes.data,
        });
      } else if (profile) {
        setForm((prev) => ({
          ...prev,
          full_name: profile.full_name || "",
          department: profile.department || "",
          ckan_org_id: profile.ckan_org_id || "",
        }));
      }
      setLoading(false);
    });
  }, [user?.id, profile]);

  useEffect(() => {
    const nextError = error || referenceError?.message || "";
    if (nextError) toast.error("Save failed", nextError);
  }, [error, referenceError?.message, toast]);

  useEffect(() => {
    if (message) toast.success("Profile updated", message);
  }, [message, toast]);

  const saveProfile = async (e, confirmed = false) => {
    e?.preventDefault?.();
    setError("");
    setMessage("");

    if (form.full_name?.trim().length < 3) {
      setError("Full name must be at least 3 characters.");
      setSaving(false);
      return;
    }
    if (!isLikelyUrl(form.google_scholar_link)) {
      setError("Google Scholar link must be a valid URL.");
      setSaving(false);
      return;
    }

    const counts = [
      ["Publications", form.publication_count],
      ["Projects", form.research_project_count],
      ["Creative works", form.creative_work_count],
      ["Awards", form.awards_count],
      ["IPs", form.ip_count],
    ];
    for (const [label, value] of counts) {
      if (Number(value) < 0) {
        setError(`${label} count cannot be negative.`);
        return;
      }
    }

    if (!confirmed) {
      setConfirmSave(true);
      return;
    }
    setSaving(true);

    const payload = {
      full_name: form.full_name?.trim() || null,
      google_scholar_link: form.google_scholar_link?.trim() || null,
      employment_status: form.employment_status?.trim() || null,
      designation: form.designation?.trim() || null,
      is_gs_faculty: Boolean(form.is_gs_faculty),
      publication_count: Number(form.publication_count || 0),
      research_project_count: Number(form.research_project_count || 0),
      creative_work_count: Number(form.creative_work_count || 0),
      awards_count: Number(form.awards_count || 0),
      ip_count: Number(form.ip_count || 0),
    };

    const { error: updateError } = await updateAffiliateProfileService(payload);

    if (updateError) {
      setError(updateError.message || "Unable to save affiliate profile.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setMessage("Affiliate profile updated successfully.");
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Affiliate Profile"
        description="Maintain your researcher affiliation details, scholar link, and productivity counts."
      />

      {loading ? (
        <div className="panel">
          <div className="panel-body text-sm text-slate-600">
            Loading affiliate profile...
          </div>
        </div>
      ) : (
        <form className="panel overflow-hidden" onSubmit={saveProfile}>
          <div className="panel-header">
            <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
              Profile Details
            </h2>
          </div>
          <div className="panel-body grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Full name</span>
                <input
                  className="control-input"
                  value={form.full_name || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Department</span>
                <input
                  className="control-input"
                  value={form.department || ""}
                  readOnly
                  disabled
                />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Affiliated RDI Center
                </span>
                <input
                  className="control-input"
                  value={
                    form.ckan_org_id
                      ? centerNameById[form.ckan_org_id] || "Selected"
                      : ""
                  }
                  readOnly
                  disabled
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Google Scholar Link
                </span>
                <input
                  className="control-input"
                  placeholder="https://scholar.google.com/..."
                  value={form.google_scholar_link || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      google_scholar_link: e.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Employment Status
                </span>
                <input
                  className="control-input"
                  placeholder="e.g. Permanent, Lecturer"
                  value={form.employment_status || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      employment_status: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">
                  Designation
                </span>
                <input
                  className="control-input"
                  placeholder="e.g. Department Head, Program Chair"
                  value={form.designation || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      designation: e.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form.is_gs_faculty)}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    is_gs_faculty: e.target.checked,
                  }))
                }
              />
              Mark as GS Faculty
            </label>

            <div className="grid gap-2 md:grid-cols-5">
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Publications
                </span>
                <input
                  className="control-input"
                  type="number"
                  min="0"
                  value={form.publication_count}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      publication_count: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Projects</span>
                <input
                  className="control-input"
                  type="number"
                  min="0"
                  value={form.research_project_count}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      research_project_count: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">
                  Creative Works
                </span>
                <input
                  className="control-input"
                  type="number"
                  min="0"
                  value={form.creative_work_count}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      creative_work_count: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">Awards</span>
                <input
                  className="control-input"
                  type="number"
                  min="0"
                  value={form.awards_count}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      awards_count: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-semibold text-slate-700">IPs</span>
                <input
                  className="control-input"
                  type="number"
                  min="0"
                  value={form.ip_count}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, ip_count: e.target.value }))
                  }
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </form>
      )}

      <ConfirmActionModal
        open={confirmSave}
        title="Confirm Profile Update"
        message="Save changes to your affiliate profile?"
        confirmLabel="Save Changes"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={async () => {
          await saveProfile(null, true);
          setConfirmSave(false);
        }}
      />
    </section>
  );
}



