import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { formatStatusLabel } from "@/utils/status";
import ReferenceDataGrid from "./ReferenceDataGrid";
import ProjectFilterBar from "./ProjectFilterBar";

const columns = [
  {
    key: "number",
    label: "No.",
    headerClassName: "hidden sm:table-cell",
    cellClassName: "hidden sm:table-cell",
  },
  {
    key: "title",
    label: "Project Title",
    cellClassName: "font-medium text-slate-900",
  },
  { key: "status", label: "Status" },
  { key: "year", label: "Year" },
  { key: "lead", label: "Lead Researcher" },
  { key: "department", label: "Department" },
  { key: "agenda", label: "Agendum" },
  {
    key: "actions",
    label: "Actions",
    headerClassName: "text-right",
    cellClassName: "text-right",
  },
];

export default function ProjectsPanel({
  links,
  filteredProjects,
  paginatedProjects,
  projectsPage,
  projectsTotalPages,
  pageSize,
  agendaFilter,
  setAgendaFilter,
  projectSearch,
  setProjectSearch,
  projectStatus,
  setProjectStatus,
  projectStatusOptions,
  projectYear,
  setProjectYear,
  projectYearOptions,
  clearProjectFilters,
  onPageChange,
  statusBadgeClass,
  goToProject,
  loading,
}) {
  const activeFilterCount = [
    Boolean(agendaFilter),
    Boolean(projectSearch.trim()),
    projectStatus !== "all",
    projectYear !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <ProjectFilterBar
        agendaFilter={agendaFilter}
        setAgendaFilter={setAgendaFilter}
        projectSearch={projectSearch}
        setProjectSearch={setProjectSearch}
        projectStatus={projectStatus}
        setProjectStatus={setProjectStatus}
        projectStatusOptions={projectStatusOptions}
        projectYear={projectYear}
        setProjectYear={setProjectYear}
        projectYearOptions={projectYearOptions}
        activeFilterCount={activeFilterCount}
        onReset={clearProjectFilters}
      />

      <ReferenceDataGrid
        title="Linked Projects"
        description={`Showing ${filteredProjects.length} project(s).`}
        columns={columns}
        rows={paginatedProjects}
        rowKey={(row, index) => row?.id || `${index}`}
        page={projectsPage}
        totalPages={projectsTotalPages}
        onPageChange={onPageChange}
        loading={loading}
        minWidthClass="min-w-[860px]"
        emptyTitle="No projects"
        emptyDescription={
          links.projects.length === 0
            ? "No linked projects found for this research center."
            : "No projects match your filters."
        }
        renderCell={(key, row, index) => {
          if (key === "number")
            return (projectsPage - 1) * pageSize + index + 1;
          if (key === "title") return row?.title || "-";
          if (key === "status") {
            return (
              <Badge
                variant="outline"
                className={`capitalize ${statusBadgeClass(row?.status)}`}
              >
                {formatStatusLabel(row?.status) || "-"}
              </Badge>
            );
          }
          if (key === "year")
            return <span className="text-slate-700">{row?.year || "-"}</span>;
          if (key === "lead")
            return (
              <span className="text-slate-700">
                {row?.lead_researcher || "-"}
              </span>
            );
          if (key === "department") {
            return (
              <span className="text-slate-700">
                {row?.department_name || "-"}
              </span>
            );
          }
          if (key === "agenda")
            return (
              <span className="text-slate-700">{row?.agenda_name || "-"}</span>
            );
          if (key === "actions") {
            return (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-600 hover:bg-blue-50"
                onClick={() => goToProject(row)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            );
          }
          return "-";
        }}
      />
    </div>
  );
}
