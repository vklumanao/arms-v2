import { useEffect, useMemo, useState } from "react";
import { isLikelyUrl } from "@/shared/utils/validation";
import PageHeader from "@/shared/components/layout/PageHeader";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import { useToast } from "@/app/providers/ToastProvider";
import {
  fetchAffiliateRegistry,
  updateAffiliateProfile,
} from "@/features/admin/services/adminAffiliatesService";

const ROLE_FILTERS = ["all", "faculty", "student"];

export default function AdminAffiliatesPage() {
  const [rows, setRows] = useState([]);
  const [centers, setCenters] = useState([]);
  const [ckanUserMode, setCkanUserMode] = useState("disabled");
  const [filters, setFilters] = useState({
    role: "all",
    center: "",
    department: "",
    search: "",
    gsOnly: false,
  });
  const [savingById, setSavingById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (error) toast.error("Update failed", error);
  }, [error, toast]);

  useEffect(() => {
    if (message) toast.success("Update successful", message);
  }, [message, toast]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchAffiliateRegistry();
      setRows(payload?.rows || []);
      setCenters(payload?.centers || []);
      setCkanUserMode(payload?.ckan_user_mode || "disabled");
    } catch (loadError) {
      setError(loadError.message || "Unable to load affiliate registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const centerNameById = useMemo(() => {
    const map = {};
    centers.forEach((center) => {
      map[center.id] = center.name;
    });
    return map;
  }, [centers]);

  const kpis = useMemo(() => {
    const faculty = rows.filter((row) => row.role === "faculty").length;
    const student = rows.filter((row) => row.role === "student").length;
    const gsFaculty = rows.filter(
      (row) => row.role === "faculty" && row.is_gs_faculty,
    ).length;
    const active = rows.filter((row) => row.is_active).length;
    return { total: rows.length, faculty, student, gsFaculty, active };
  }, [rows]);

  const departments = useMemo(() => {
    const set = new Set();
    rows.forEach((row) => {
      if (row.department) set.add(row.department);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.role !== "all" && row.role !== filters.role) return false;
      if (filters.center && row.ckan_org_id !== filters.center) return false;
      if (filters.department && row.department !== filters.department)
        return false;
      if (filters.gsOnly && !row.is_gs_faculty) return false;
      if (filters.search) {
        const keyword = filters.search.toLowerCase();
        const target =
          `${row.full_name || ""} ${row.email || ""} ${row.department || ""}`.toLowerCase();
        if (!target.includes(keyword)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const setRowField = (id, key, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? row.source === "ckan_only"
            ? row
            : { ...row, [key]: value }
          : row,
      ),
    );
  };

  const saveRow = async (row, confirmed = false) => {
    setError("");
    setMessage("");

    if (row.source === "ckan_only") {
      setError(
        "CKAN-only user cannot be edited here until linked to an ARMS account.",
      );
      return;
    }

    if (!isLikelyUrl(row.google_scholar_link)) {
      setError("Google Scholar link must be a valid URL.");
      setSavingById((prev) => ({ ...prev, [row.id]: false }));
      return;
    }
    const counts = [
      ["publication_count", row.publication_count],
      ["research_project_count", row.research_project_count],
      ["creative_work_count", row.creative_work_count],
      ["awards_count", row.awards_count],
      ["ip_count", row.ip_count],
    ];
    for (const [key, value] of counts) {
      if (Number(value) < 0) {
        setError(`${key} cannot be negative.`);
        return;
      }
    }

    if (!confirmed) {
      setConfirmAction({
        row,
        title: "Confirm Affiliate Update",
        message: `Save updates for ${row.full_name || row.email || "this affiliate"}?`,
        confirmLabel: "Save Changes",
      });
      return;
    }
    setSavingById((prev) => ({ ...prev, [row.id]: true }));

    const payload = {
      department: row.department || null,
      ckan_org_id: row.ckan_org_id || null,
      google_scholar_link: row.google_scholar_link || null,
      employment_status: row.employment_status || null,
      designation: row.designation || null,
      is_gs_faculty: Boolean(row.is_gs_faculty),
      publication_count: Number(row.publication_count || 0),
      research_project_count: Number(row.research_project_count || 0),
      creative_work_count: Number(row.creative_work_count || 0),
      awards_count: Number(row.awards_count || 0),
      ip_count: Number(row.ip_count || 0),
    };

    try {
      await updateAffiliateProfile(row.id, payload);
    } catch (updateError) {
      setError(updateError.message || "Unable to save affiliate.");
      setSavingById((prev) => ({ ...prev, [row.id]: false }));
      return;
    }

    setSavingById((prev) => ({ ...prev, [row.id]: false }));
    setMessage(`Affiliate profile updated: ${row.full_name || row.email}`);
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Affiliate Registry"
        description="Manage Faculty and Student affiliate records, scholar links, designations, and productivity counters."
      />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <div className="kpi-card">
          <p className="kpi-label">Total Affiliates</p>
          <p className="kpi-value">{kpis.total}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Faculty</p>
          <p className="kpi-value">{kpis.faculty}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Students</p>
          <p className="kpi-value">{kpis.student}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">GS Faculty</p>
          <p className="kpi-value">{kpis.gsFaculty}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Active</p>
          <p className="kpi-value">{kpis.active}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <select
            className="control-select"
            value={filters.role}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, role: e.target.value }))
            }
          >
            {ROLE_FILTERS.map((role) => (
              <option key={role} value={role}>
                {role === "all" ? "All roles" : role}
              </option>
            ))}
          </select>

          <select
            className="control-select"
            value={filters.center}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, center: e.target.value }))
            }
          >
            <option value="">All centers</option>
            {centers.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>

          <select
            className="control-select"
            value={filters.department}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, department: e.target.value }))
            }
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>

          <input
            className="control-input"
            placeholder="Search name/email"
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
          />

          <label className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={filters.gsOnly}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, gsOnly: e.target.checked }))
              }
            />
            GS faculty only
          </label>
        </div>
        <div className="px-4 pb-3 text-xs text-slate-600">
          {ckanUserMode === "enabled"
            ? "CKAN users are included in this list. Rows marked CKAN only are read-only."
            : "CKAN user list is disabled. Set CKAN admin API key to include CKAN users."}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            Affiliate Records ({filteredRows.length})
          </h2>
          <button
            className="btn btn-outline"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="panel-body pt-0">
          <div className="max-h-[72vh] overflow-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Name</th>
                  <th>Source</th>
                  <th>CKAN Username</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Center</th>
                  <th>Scholar Link</th>
                  <th>Employment</th>
                  <th>Designation</th>
                  <th>GS</th>
                  <th>Pubs</th>
                  <th>Projects</th>
                  <th>Creative</th>
                  <th>Awards</th>
                  <th>IPs</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {!loading && filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={17}>
                      No affiliates matched the current filters.
                    </td>
                  </tr>
                ) : null}
                {filteredRows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>
                      <p className="font-semibold">{row.full_name || "-"}</p>
                      <p className="text-xs text-slate-500">
                        {row.email || "-"}
                      </p>
                    </td>
                    <td>
                      <span
                        className={`status-chip ${
                          row.link_status === "linked"
                            ? "status-completed"
                            : row.link_status === "ckan_only"
                              ? "status-ongoing"
                              : "status-proposal"
                        }`}
                      >
                        {row.link_status === "linked"
                          ? "Linked"
                          : row.link_status === "ckan_only"
                            ? "CKAN only"
                            : "ARMS only"}
                      </span>
                    </td>
                    <td>
                      <code className="text-xs">
                        {row.ckan_username || "-"}
                      </code>
                    </td>
                    <td className="capitalize">{row.role || "-"}</td>
                    <td>
                      <input
                        className="control-input min-w-36"
                        value={row.department || ""}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(row.id, "department", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="control-select min-w-36"
                        value={row.ckan_org_id || ""}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(
                            row.id,
                            "ckan_org_id",
                            e.target.value || null,
                          )
                        }
                      >
                        <option value="">None</option>
                        {centers.map((center) => (
                          <option key={center.id} value={center.id}>
                            {center.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.ckan_org_id
                          ? centerNameById[row.ckan_org_id] || "Selected"
                          : "None"}
                      </p>
                    </td>
                    <td>
                      <input
                        className="control-input min-w-48"
                        value={row.google_scholar_link || ""}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(
                            row.id,
                            "google_scholar_link",
                            e.target.value,
                          )
                        }
                        placeholder="https://..."
                      />
                    </td>
                    <td>
                      <input
                        className="control-input min-w-32"
                        value={row.employment_status || ""}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(
                            row.id,
                            "employment_status",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="control-input min-w-56"
                        value={row.designation || ""}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(row.id, "designation", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(row.is_gs_faculty)}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(row.id, "is_gs_faculty", e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="control-input w-20"
                        type="number"
                        min="0"
                        value={row.publication_count ?? 0}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(
                            row.id,
                            "publication_count",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="control-input w-20"
                        type="number"
                        min="0"
                        value={row.research_project_count ?? 0}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(
                            row.id,
                            "research_project_count",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="control-input w-20"
                        type="number"
                        min="0"
                        value={row.creative_work_count ?? 0}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(
                            row.id,
                            "creative_work_count",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="control-input w-20"
                        type="number"
                        min="0"
                        value={row.awards_count ?? 0}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(row.id, "awards_count", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="control-input w-20"
                        type="number"
                        min="0"
                        value={row.ip_count ?? 0}
                        disabled={row.source === "ckan_only"}
                        onChange={(e) =>
                          setRowField(row.id, "ip_count", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        disabled={
                          Boolean(savingById[row.id]) ||
                          row.source === "ckan_only"
                        }
                        onClick={() => saveRow(row)}
                      >
                        {row.source === "ckan_only"
                          ? "Read only"
                          : savingById[row.id]
                            ? "Saving..."
                            : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmActionModal
        open={Boolean(confirmAction)}
        title={confirmAction?.title || "Confirm Action"}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirm"}
        loading={Boolean(
          confirmAction?.row?.id && savingById[confirmAction.row.id],
        )}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (!confirmAction?.row) return;
          await saveRow(confirmAction.row, true);
          setConfirmAction(null);
        }}
      />
    </section>
  );
}


