import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useReferenceData } from "@/hooks/useReferenceData";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLikelyUrl, validatePasswordStrength } from "@/utils/validation";
import {
  changeMyPassword,
  fetchAffiliateProfile,
  updateAffiliateProfile as updateAffiliateProfileService,
} from "@/services/submissions";
import ConfirmActionModal from "@/components/feedback/ConfirmActionModal";
import { useToast } from "@/components/providers/ToastProvider";

const INITIAL_FORM = {
  first_name: "",
  middle_initial: "",
  last_name: "",
  department: "",
  ckan_org_id: "",
  google_scholar_link: "",
  employment_status: "",
  designation: "",
  is_gs_faculty: false,
};

const INITIAL_PASSWORD_FORM = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export default function AffiliateProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { centers, departments, error: referenceError } = useReferenceData();
  const NONE_SELECT_VALUE = "__none__";
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmPasswordChange, setConfirmPasswordChange] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM);
  const [originalOrgId, setOriginalOrgId] = useState("");
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const toast = useToast();

  const parseNameParts = (fullName = "") => {
    const raw = String(fullName || "").trim();
    if (!raw) return { first_name: "", middle_initial: "", last_name: "" };

    if (raw.includes(",")) {
      const [lastPart = "", givenPart = ""] = raw.split(",", 2);
      const givenTokens = givenPart.trim().split(/\s+/).filter(Boolean);
      const first = givenTokens[0] || "";
      const middleToken = givenTokens[1] || "";
      const middle = middleToken.replace(/\./g, "").charAt(0) || "";
      return {
        first_name: first,
        middle_initial: middle,
        last_name: lastPart.trim(),
      };
    }

    const tokens = raw.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      return { first_name: tokens[0], middle_initial: "", last_name: "" };
    }
    const first = tokens[0];
    const middleCandidate = tokens[1] || "";
    const isMiddleInitial = /^[A-Za-z](\.)?$/.test(middleCandidate);
    const middle = isMiddleInitial
      ? middleCandidate.replace(/\./g, "").charAt(0)
      : "";
    const last = (isMiddleInitial ? tokens.slice(2) : tokens.slice(1)).join(
      " ",
    );
    return {
      first_name: first,
      middle_initial: middle,
      last_name: last,
    };
  };

  const buildFormFromProfile = (data) => {
    const nameParts = parseNameParts(data?.full_name);
    return {
      ...INITIAL_FORM,
      first_name: nameParts.first_name || "",
      middle_initial: nameParts.middle_initial || "",
      last_name: nameParts.last_name || "",
      department: data?.department || "",
      ckan_org_id: data?.ckan_org_id || "",
      ckan_group_id: data?.ckan_group_id || "",
      google_scholar_link: data?.google_scholar_link || "",
      employment_status: data?.employment_status || "",
      designation: data?.designation || "",
      is_gs_faculty: Boolean(data?.is_gs_faculty),
    };
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchAffiliateProfile().then((profileRes) => {
      if (profileRes.data) {
        setForm(buildFormFromProfile(profileRes.data));
        setOriginalOrgId(String(profileRes.data?.ckan_org_id || "").trim());
      } else if (profile) {
        setForm(buildFormFromProfile(profile));
        setOriginalOrgId(String(profile?.ckan_org_id || "").trim());
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

    if (!form.first_name?.trim()) {
      setError("First name is required.");
      setSaving(false);
      return;
    }
    if (!form.last_name?.trim()) {
      setError("Last name is required.");
      setSaving(false);
      return;
    }
    if (!isLikelyUrl(form.google_scholar_link)) {
      setError("Google Scholar link must be a valid URL.");
      setSaving(false);
      return;
    }
    if (originalOrgId && !String(form.ckan_org_id || "").trim()) {
      setError("Research Center cannot be cleared once it has been set.");
      setSaving(false);
      return;
    }

    if (!confirmed) {
      setConfirmSave(true);
      return;
    }
    setSaving(true);

    const payload = {
      first_name: form.first_name?.trim() || null,
      middle_initial: form.middle_initial?.trim() || null,
      last_name: form.last_name?.trim() || null,
      department: form.department?.trim() || null,
      ckan_org_id: form.ckan_org_id?.trim() || null,
      ckan_group_id: form.ckan_group_id?.trim() || null,
      google_scholar_link: form.google_scholar_link?.trim() || null,
      employment_status: form.employment_status?.trim() || null,
      designation: form.designation?.trim() || null,
      is_gs_faculty: Boolean(form.is_gs_faculty),
    };

    const { data, error: updateError } =
      await updateAffiliateProfileService(payload);

    if (updateError) {
      setError(updateError.message || "Unable to save affiliate profile.");
      setSaving(false);
      return;
    }

    setSaving(false);
    await refreshProfile();
    if (Array.isArray(data?.warnings) && data.warnings.length) {
      data.warnings.forEach((warning) =>
        toast.error("CKAN sync warning", String(warning || "Unknown warning.")),
      );
    }
    setMessage("Profile updated successfully.");
  };

  const validatePasswordForm = () => {
    if (!passwordForm.current_password) {
      return "Current password is required.";
    }
    const strengthError = validatePasswordStrength(passwordForm.new_password);
    if (strengthError) return strengthError;
    if (passwordForm.current_password === passwordForm.new_password) {
      return "New password must be different from current password.";
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      return "New password and confirmation do not match.";
    }
    return "";
  };

  const requestPasswordChange = (e) => {
    e.preventDefault();
    setPasswordError("");
    const nextError = validatePasswordForm();
    if (nextError) {
      setPasswordError(nextError);
      return;
    }
    setConfirmPasswordChange(true);
  };

  const confirmChangePassword = async () => {
    setPasswordError("");
    setChangingPassword(true);
    const { data, error: changeError } = await changeMyPassword({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
      confirm_password: passwordForm.confirm_password,
    });
    setChangingPassword(false);

    if (changeError) {
      setPasswordError(changeError.message || "Unable to change password.");
      return;
    }

    setPasswordForm(INITIAL_PASSWORD_FORM);
    setConfirmPasswordChange(false);
    toast.success(
      "Password updated",
      data?.warning || "Your password was changed successfully.",
    );
  };

  return (
    <section className="page-stack-lg">
      {loading ? (
        <Card className="overflow-hidden">
          <CardContent className="p-5 text-sm text-slate-600">
            Loading profile...
          </CardContent>
        </Card>
      ) : (
        <div className="page-stack">
          <form onSubmit={saveProfile}>
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Profile Details
                </CardTitle>
                <CardDescription>
                  Update your personal information.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Personal Info
                  </span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2 sm:grid-cols-3 sm:col-span-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        First name
                      </span>
                      <Input
                        value={form.first_name || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            first_name: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Middle initial
                      </span>
                      <Input
                        maxLength={2}
                        value={form.middle_initial || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            middle_initial: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-semibold text-slate-700">
                        Last name
                      </span>
                      <Input
                        value={form.last_name || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            last_name: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Department
                    </span>
                    <Select
                      value={form.ckan_group_id || NONE_SELECT_VALUE}
                      onValueChange={(value) => {
                        if (value === NONE_SELECT_VALUE) {
                          setForm((prev) => ({
                            ...prev,
                            ckan_group_id: "",
                            department: "",
                          }));
                          return;
                        }
                        const selected = (departments || []).find(
                          (row) =>
                            String(row?.id || "")
                              .trim()
                              .toLowerCase() ===
                            String(value || "")
                              .trim()
                              .toLowerCase(),
                        );
                        setForm((prev) => ({
                          ...prev,
                          ckan_group_id: value,
                          department: selected?.name || "",
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>
                        {(departments || []).map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {row.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Affiliation
                  </span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Research Center
                    </span>
                    <Select
                      value={form.ckan_org_id || NONE_SELECT_VALUE}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          ckan_org_id: value === NONE_SELECT_VALUE ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select research center" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>
                        {(centers || []).map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {row.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Google Scholar Link
                    </span>
                    <Input
                      type="url"
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

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Professional
                  </span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-700">
                      Employment Status
                    </span>
                    <Select
                      value={form.employment_status || NONE_SELECT_VALUE}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          employment_status:
                            value === NONE_SELECT_VALUE ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_SELECT_VALUE}>None</SelectItem>
                        <SelectItem value="Permanent">Permanent</SelectItem>
                        <SelectItem value="Lecturer">Lecturer</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="font-semibold text-slate-700">
                      Designation
                    </span>
                    <Input
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

                <div className="flex justify-end">
                  <Button disabled={saving}>
                    {saving ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          <form onSubmit={requestPasswordChange}>
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-[var(--border)] px-6 py-5">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Change Password
                </CardTitle>
                <CardDescription>Update your account password.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 sm:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Current Password
                  </span>
                  <div className="relative">
                    <Input
                      className="pr-10"
                      type={showPassword.current ? "text" : "password"}
                      value={passwordForm.current_password}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          current_password: e.target.value,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-600 hover:text-slate-900"
                      aria-label={
                        showPassword.current
                          ? "Hide current password"
                          : "Show current password"
                      }
                      onClick={() =>
                        setShowPassword((prev) => ({
                          ...prev,
                          current: !prev.current,
                        }))
                      }
                    >
                      {showPassword.current ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </Button>
                  </div>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    New Password
                  </span>
                  <div className="relative">
                    <Input
                      className="pr-10"
                      type={showPassword.next ? "text" : "password"}
                      value={passwordForm.new_password}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          new_password: e.target.value,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-600 hover:text-slate-900"
                      aria-label={
                        showPassword.next
                          ? "Hide new password"
                          : "Show new password"
                      }
                      onClick={() =>
                        setShowPassword((prev) => ({
                          ...prev,
                          next: !prev.next,
                        }))
                      }
                    >
                      {showPassword.next ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </Button>
                  </div>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-slate-700">
                    Confirm New Password
                  </span>
                  <div className="relative">
                    <Input
                      className="pr-10"
                      type={showPassword.confirm ? "text" : "password"}
                      value={passwordForm.confirm_password}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirm_password: e.target.value,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-600 hover:text-slate-900"
                      aria-label={
                        showPassword.confirm
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                      onClick={() =>
                        setShowPassword((prev) => ({
                          ...prev,
                          confirm: !prev.confirm,
                        }))
                      }
                    >
                      {showPassword.confirm ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </Button>
                  </div>
                </label>

                <div className="sm:col-span-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Password must be at least 8 characters and include
                    uppercase, lowercase, and a number.
                  </p>
                  <Button disabled={changingPassword} type="submit">
                    {changingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>

                {passwordError ? (
                  <p className="sm:col-span-3 text-sm text-[var(--danger)]">
                    {passwordError}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </form>
        </div>
      )}

      <ConfirmActionModal
        open={confirmSave}
        title="Confirm Profile Update"
        message="Save changes to your profile?"
        confirmLabel="Save Changes"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={async () => {
          await saveProfile(null, true);
          setConfirmSave(false);
        }}
      />
      <ConfirmActionModal
        open={confirmPasswordChange}
        title="Confirm Password Change"
        message="Update your account password now?"
        confirmLabel="Update Password"
        loading={changingPassword}
        onCancel={() => setConfirmPasswordChange(false)}
        onConfirm={confirmChangePassword}
      />
    </section>
  );
}
