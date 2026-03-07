import { useMemo, useState } from "react";
import PageHeader from "@/shared/components/layout/PageHeader";

export default function AwardsRecognitionPage() {
  const rows = [];
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const levelOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows.map((row) => String(row?.level || "").trim()).filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => String(row?.year_received || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = String(searchTerm || "")
      .trim()
      .toLowerCase();
    return rows.filter((row) => {
      const level = String(row?.level || "").trim();
      const year = String(row?.year_received || "").trim();
      const haystack = [
        row?.program_department,
        row?.work_title,
        row?.award_recognition,
        row?.awarding_body,
        row?.recipients,
        row?.supporting_movs,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      const matchesSearch = query ? haystack.includes(query) : true;
      const matchesLevel = levelFilter === "all" ? true : level === levelFilter;
      const matchesYear = yearFilter === "all" ? true : year === yearFilter;
      return matchesSearch && matchesLevel && matchesYear;
    });
  }, [levelFilter, rows, searchTerm, yearFilter]);

  const resetFilters = () => {
    setSearchTerm("");
    setLevelFilter("all");
    setYearFilter("all");
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Awards and Recognition"
        description="Track and manage awards and recognitions related to your research work."
      />

      <div className="panel">
        <div className="panel-header">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
            Filters
          </h2>
        </div>
        <div className="panel-body grid gap-3 md:grid-cols-4">
          <label className="block space-y-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Title, award, body, recipient..."
              className="control-input"
            />
          </label>

          <label className="block space-y-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Level
            </span>
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              className="control-select"
            >
              <option value="all">All levels</option>
              {levelOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Year Received
            </span>
            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="control-select"
            >
              <option value="all">All years</option>
              {yearOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={resetFilters}
            >
              Reset
            </button>
            <p className="text-xs text-slate-500">
              {filteredRows.length} result{filteredRows.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Title of Research</th>
                <th>Award/Recognition</th>
                <th>Awarding Body</th>
                <th>Year Received</th>
                <th>Level</th>
                <th>Recipient(s)</th>
                <th>Supporting MOVs</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {filteredRows.length ? (
                filteredRows.map((row, index) => (
                  <tr key={row.id || index}>
                    <td>{row.program_department || "-"}</td>
                    <td>{row.work_title || "-"}</td>
                    <td>{row.award_recognition || "-"}</td>
                    <td>{row.awarding_body || "-"}</td>
                    <td>{row.year_received || "-"}</td>
                    <td>{row.level || "-"}</td>
                    <td>{row.recipients || "-"}</td>
                    <td>{row.supporting_movs || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center text-sm text-slate-500"
                  >
                    No matching awards and recognition records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
