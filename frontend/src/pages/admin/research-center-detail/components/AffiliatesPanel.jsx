import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import ReferenceDataGrid from "./ReferenceDataGrid";

const columns = [
  { key: "number", label: "No.", headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
  { key: "full_name", label: "Full Name", cellClassName: "font-medium text-slate-900" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "department", label: "Department" },
  { key: "actions", label: "Actions", headerClassName: "text-right", cellClassName: "text-right" },
];

export default function AffiliatesPanel({
  links,
  center,
  paginatedAffiliates,
  affiliatesPage,
  affiliatesTotalPages,
  pageSize,
  onPageChange,
  onUnlink,
  loading,
}) {
  return (
    <ReferenceDataGrid
      title="Linked Affiliates"
      description={`Showing ${links.profiles.length} affiliate(s).`}
      columns={columns}
      rows={paginatedAffiliates}
      rowKey={(row, index) => row?.id || `${index}`}
      page={affiliatesPage}
      totalPages={affiliatesTotalPages}
      onPageChange={onPageChange}
      loading={loading}
      minWidthClass="min-w-[720px]"
      emptyTitle="No affiliates"
      emptyDescription="No linked affiliates found for this research center."
      renderCell={(key, row, index) => {
        const rowId = String(row?.id || "").trim();
        const centerChiefId = String(center?.centerChiefId || "").trim();
        const isChief = rowId && centerChiefId && rowId === centerChiefId;

        if (key === "number") return (affiliatesPage - 1) * pageSize + index + 1;
        if (key === "full_name") return row?.full_name || row?.name || "-";
        if (key === "email") return <span className="text-slate-700">{row?.email || "-"}</span>;
        if (key === "role") return <span className="capitalize text-slate-700">{row?.role || "-"}</span>;
        if (key === "department") return <span className="text-slate-700">{row?.department || "-"}</span>;
        if (key === "actions") {
          return (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:bg-slate-50"
              disabled={isChief}
              onClick={() => onUnlink(row)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          );
        }
        return "-";
      }}
    />
  );
}
