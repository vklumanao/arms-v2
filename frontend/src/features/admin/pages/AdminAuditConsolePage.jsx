import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/shared/components/layout/PageHeader";
import InlineNotice from "@/shared/components/feedback/InlineNotice";
import EmptyState from "@/shared/components/feedback/EmptyState";
import ConfirmActionModal from "@/shared/components/feedback/ConfirmActionModal";
import PaginationControls from "@/shared/components/navigation/PaginationControls";
import {
  describeAuditEvent,
  formatEntityDisplay,
  formatRequestDisplay,
  getChangedFields,
  paginateItemsWithMeta,
  toEntityLabel,
  toIsoDateEnd,
} from "@/features/admin/utils";
import {
  archiveOldNotifications as archiveOldNotificationsService,
  fetchAuditConsoleData,
  fetchNotificationMetrics,
} from "@/features/admin/services";

const AUDIT_EVENTS_PAGE_SIZE = 10;

export default function AdminAuditConsolePage() {
  const [logs, setLogs] = useState([]);
  const [actorMap, setActorMap] = useState({});
  const [entityNameByType, setEntityNameByType] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [notifMetrics, setNotifMetrics] = useState({
    total_count: 0,
    unread_count: 0,
    high_priority_count: 0,
    pinned_count: 0,
    archived_count: 0,
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [auditEventsPage, setAuditEventsPage] = useState(1);
  const [filters, setFilters] = useState({
    action: "",
    entity: "",
    actor: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });

  const loadLogs = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await fetchAuditConsoleData();
      setLogs(data.logs);
      setActorMap(data.actorMap);
      setEntityNameByType(data.entityNameByType || {});
    } catch (loadError) {
      setError(loadError.message || "Unable to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  const loadNotificationMetrics = async () => {
    const metrics = await fetchNotificationMetrics(30);
    if (metrics) setNotifMetrics(metrics);
  };

  const archiveOldNotifications = async () => {
    setArchiving(true);
    setError("");
    setMessage("");
    try {
      const archivedCount = await archiveOldNotificationsService(90);
      setMessage(`Archived ${archivedCount || 0} old notification(s).`);
      await loadNotificationMetrics();
    } catch (archiveError) {
      setError(archiveError.message || "Unable to archive notifications.");
    } finally {
      setArchiving(false);
    }
  };

  useEffect(() => {
    loadLogs();
    loadNotificationMetrics();
  }, []);

  const filteredLogs = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return logs.filter((row) => {
      if (filters.action && row.action_type !== filters.action) return false;
      if (filters.entity && row.entity_type !== filters.entity) return false;
      if (
        filters.actor &&
        !String(row.actor_id || "")
          .toLowerCase()
          .includes(filters.actor.toLowerCase()) &&
        !String(actorMap[row.actor_id] || "")
          .toLowerCase()
          .includes(filters.actor.toLowerCase())
      ) {
        return false;
      }

      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom).getTime();
        if (new Date(row.created_at).getTime() < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(toIsoDateEnd(filters.dateTo)).getTime();
        if (new Date(row.created_at).getTime() > to) return false;
      }

      if (search) {
        const haystack =
          `${row.action_type || ""} ${row.entity_type || ""} ${row.entity_id || ""} ${row.request_id || ""} ${JSON.stringify(row.metadata || {})} ${JSON.stringify(row.old_values || {})} ${JSON.stringify(row.new_values || {})} ${(row.actor_id && actorMap[row.actor_id]) || ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [logs, filters, actorMap]);

  const actionOptions = [
    ...new Set(logs.map((row) => row.action_type).filter(Boolean)),
  ];
  const entityOptions = [
    ...new Set(logs.map((row) => row.entity_type).filter(Boolean)),
  ];

  const resolveEntityName = (row) => {
    const type = row.entity_type;
    const id = row.entity_id;
    if (!type || !id) return null;
    const bucket =
      entityNameByType[type] || entityNameByType[type?.replace(/s$/, "")];
    return bucket?.[id] || null;
  };

  const paginatedAuditEvents = useMemo(
    () =>
      paginateItemsWithMeta(
        filteredLogs,
        auditEventsPage,
        AUDIT_EVENTS_PAGE_SIZE,
      ),
    [filteredLogs, auditEventsPage],
  );

  const groupedTimeline = useMemo(() => {
    const groups = new Map();
    paginatedAuditEvents.items.forEach((row) => {
      const dayKey = new Date(row.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      if (!groups.has(dayKey)) groups.set(dayKey, []);
      groups.get(dayKey).push(row);
    });
    return Array.from(groups.entries()).map(([day, events]) => ({
      day,
      events,
    }));
  }, [paginatedAuditEvents.items]);

  useEffect(() => {
    setAuditEventsPage(1);
  }, [
    filters.action,
    filters.entity,
    filters.actor,
    filters.search,
    filters.dateFrom,
    filters.dateTo,
  ]);

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const columns = [
      { key: "timestamp", label: "Timestamp", width: 130 },
      { key: "actor", label: "Actor", width: 150 },
      { key: "action", label: "Action", width: 140 },
      { key: "entity", label: "Entity", width: 140 },
      {
        key: "description",
        label: "Description",
        width: pageWidth - margin * 2 - 130 - 150 - 140 - 140,
      },
    ];

    const rows = filteredLogs.map((row) => ({
      timestamp: new Date(row.created_at).toLocaleString(),
      actor: row.actor_id ? actorMap[row.actor_id] || row.actor_id : "-",
      action: row.action_type || "-",
      entity: toEntityLabel(row.entity_type),
      description: describeAuditEvent(row),
    }));

    let y = margin;
    doc.setFontSize(14);
    doc.text("ARMS Audit Report", margin, y);
    y += 18;
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 18;
    doc.text(`Rows: ${rows.length}`, margin, y);
    y += 16;

    const drawHeader = () => {
      let x = margin;
      doc.setFontSize(9);
      doc.setFont(undefined, "bold");
      columns.forEach((col) => {
        doc.text(col.label, x + 2, y);
        x += col.width;
      });
      doc.setFont(undefined, "normal");
      y += 10;
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    };

    drawHeader();

    rows.forEach((row) => {
      const rowLines = columns.map((col) => {
        const text = String(row[col.key] || "");
        return doc.splitTextToSize(text, col.width - 6);
      });
      const rowHeight =
        Math.max(...rowLines.map((lines) => lines.length)) * 11 + 4;

      if (y + rowHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        drawHeader();
      }

      let x = margin;
      rowLines.forEach((lines, idx) => {
        doc.text(lines, x + 2, y + 9);
        x += columns[idx].width;
      });
      y += rowHeight;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    });

    doc.save(`arms-audit-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportJson = () => {
    const payload = filteredLogs.map((row) => ({
      ...row,
      actor_name: row.actor_id ? actorMap[row.actor_id] || row.actor_id : null,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arms-audit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page-stack-lg">
      <PageHeader
        title="Audit Console"
        description="Track administrative actions, reviewer assignments, approvals, visibility updates, and role changes."
      />
      <InlineNotice type="error" title="Audit load issue" message={error} />
      <InlineNotice
        type="success"
        title="Audit action done"
        message={message}
      />

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <div className="kpi-card">
          <p className="kpi-label">Notif 30d Total</p>
          <p className="kpi-value">{notifMetrics.total_count || 0}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Unread</p>
          <p className="kpi-value">{notifMetrics.unread_count || 0}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">High Priority</p>
          <p className="kpi-value">{notifMetrics.high_priority_count || 0}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Pinned</p>
          <p className="kpi-value">{notifMetrics.pinned_count || 0}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Archived</p>
          <p className="kpi-value">{notifMetrics.archived_count || 0}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          <select
            className="control-select"
            value={filters.action}
            onChange={(e) =>
              setFilters((p) => ({ ...p, action: e.target.value }))
            }
          >
            <option value="">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <select
            className="control-select"
            value={filters.entity}
            onChange={(e) =>
              setFilters((p) => ({ ...p, entity: e.target.value }))
            }
          >
            <option value="">All entities</option>
            {entityOptions.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
          <input
            className="control-input"
            placeholder="Actor name or UUID"
            value={filters.actor}
            onChange={(e) =>
              setFilters((p) => ({ ...p, actor: e.target.value }))
            }
          />
          <input
            className="control-input"
            placeholder="Search metadata/request"
            value={filters.search}
            onChange={(e) =>
              setFilters((p) => ({ ...p, search: e.target.value }))
            }
          />
          <input
            type="date"
            className="control-input"
            value={filters.dateFrom}
            onChange={(e) =>
              setFilters((p) => ({ ...p, dateFrom: e.target.value }))
            }
          />
          <input
            type="date"
            className="control-input"
            value={filters.dateTo}
            onChange={(e) =>
              setFilters((p) => ({ ...p, dateTo: e.target.value }))
            }
          />
          <button
            className="btn btn-outline"
            onClick={() =>
              setFilters({
                action: "",
                entity: "",
                actor: "",
                search: "",
                dateFrom: "",
                dateTo: "",
              })
            }
          >
            Clear
          </button>
          <button
            className="btn btn-outline"
            onClick={loadLogs}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={exportPdf}>
            Export PDF
          </button>
          <button className="btn btn-outline" onClick={exportJson}>
            Export JSON
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setConfirmArchive(true)}
            disabled={archiving}
          >
            {archiving ? "Archiving..." : "Archive >90d Notifs"}
          </button>
        </div>
      </div>

      <ConfirmActionModal
        open={confirmArchive}
        title="Confirm Archive"
        message="Archive notifications older than 90 days (excluding pinned)?"
        confirmLabel="Archive"
        loading={archiving}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={async () => {
          await archiveOldNotifications();
          setConfirmArchive(false);
        }}
      />

      {loading ? (
        <div className="panel">
          <div className="panel-body text-sm text-slate-600">
            Loading audit logs...
          </div>
        </div>
      ) : null}

      {!loading && filteredLogs.length === 0 ? (
        <EmptyState
          title="No audit logs found"
          description="Try adjusting filters or trigger admin actions to populate audit records."
        />
      ) : null}

      {!loading && filteredLogs.length > 0 ? (
        <div className="space-y-4">
          <div className="panel">
            <div className="panel-header">
              <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                Audit Events ({filteredLogs.length})
              </h2>
            </div>
            <div className="panel-body pt-0">
              <p className="mb-3 text-xs text-slate-500">
                Showing {paginatedAuditEvents.start + 1}-
                {paginatedAuditEvents.end} of {paginatedAuditEvents.totalItems}
              </p>
              <div className="max-h-[75vh] overflow-auto app-card app-card-compact">
                <div className="space-y-4">
                  {groupedTimeline.map((group) => (
                    <section
                      key={group.day}
                      className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white"
                    >
                      <div className="border-b border-[var(--border)] px-3 py-2">
                        <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                          {group.day} ({group.events.length})
                        </h3>
                      </div>
                      <div className="space-y-2 p-3">
                        {group.events.map((row) => {
                          const actorName = row.actor_id
                            ? actorMap[row.actor_id] || row.actor_id
                            : "System";
                          const entityName = resolveEntityName(row);
                          return (
                            <article
                              key={row.id}
                              className="app-card-muted app-card-compact"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {describeAuditEvent(row)}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(row.created_at).toLocaleString()}{" "}
                                    | {formatRequestDisplay(row)}
                                  </p>
                                </div>
                                <button
                                  className="btn btn-outline"
                                  onClick={() => setSelectedEvent(row)}
                                >
                                  View
                                </button>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="status-chip status-ongoing">
                                  Actor: {actorName}
                                </span>
                                <span className="status-chip status-proposal">
                                  Action: {row.action_type || "-"}
                                </span>
                                <span className="status-chip status-completed">
                                  Entity:{" "}
                                  {entityName
                                    ? `${toEntityLabel(row.entity_type)} - ${entityName}`
                                    : formatEntityDisplay(row)}
                                </span>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
              <PaginationControls
                page={paginatedAuditEvents.page}
                totalPages={paginatedAuditEvents.totalPages}
                onPageChange={setAuditEventsPage}
                className="mt-3"
              />
            </div>
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <div
          className="modal-overlay"
          onClick={() => setSelectedEvent(null)}
        >
          <aside
            className="ml-auto h-full w-full max-w-3xl overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Audit Event Detail
              </h3>
              <button
                className="btn btn-outline"
                onClick={() => setSelectedEvent(null)}
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="app-card app-card-compact text-sm">
                <p>
                  <span className="font-semibold">Time:</span>{" "}
                  {new Date(selectedEvent.created_at).toLocaleString()}
                </p>
                <p>
                  <span className="font-semibold">Actor:</span>{" "}
                  {selectedEvent.actor_id
                    ? actorMap[selectedEvent.actor_id] || selectedEvent.actor_id
                    : "-"}
                </p>
                <p>
                  <span className="font-semibold">Action:</span>{" "}
                  {selectedEvent.action_type}
                </p>
                <p>
                  <span className="font-semibold">Entity:</span>{" "}
                  {resolveEntityName(selectedEvent)
                    ? `${toEntityLabel(selectedEvent.entity_type)} - ${resolveEntityName(selectedEvent)}`
                    : formatEntityDisplay(selectedEvent)}
                </p>
                <p>
                  <span className="font-semibold">Entity Type:</span>{" "}
                  {selectedEvent.entity_type || "-"}
                </p>
                <p>
                  <span className="font-semibold">Request:</span>{" "}
                  {formatRequestDisplay(selectedEvent)}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">Description:</span>{" "}
                  {describeAuditEvent(selectedEvent)}
                </p>
                <p>
                  <span className="font-semibold">Source:</span>{" "}
                  {selectedEvent.metadata?.source || "-"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="status-chip status-ongoing">
                    Actor:{" "}
                    {selectedEvent.actor_id
                      ? actorMap[selectedEvent.actor_id] ||
                        selectedEvent.actor_id
                      : "System"}
                  </span>
                  <span className="status-chip status-proposal">
                    Action: {selectedEvent.action_type || "-"}
                  </span>
                  <span className="status-chip status-completed">
                    Entity:{" "}
                    {resolveEntityName(selectedEvent)
                      ? `${toEntityLabel(selectedEvent.entity_type)} - ${resolveEntityName(selectedEvent)}`
                      : formatEntityDisplay(selectedEvent)}
                  </span>
                </div>
              </div>
              <div className="app-card app-card-compact text-sm">
                <p className="mb-1 font-semibold">Readable Summary</p>
                <ul className="space-y-1 text-xs text-slate-700">
                  <li>Action: {selectedEvent.action_type || "-"}</li>
                  <li>Entity Type: {selectedEvent.entity_type || "-"}</li>
                  <li>Entity ID: {selectedEvent.entity_id || "-"}</li>
                  <li>
                    Claim Role: {selectedEvent.metadata?.claim_role || "-"}
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="mb-2 font-semibold text-amber-800">
                  Before (Old Values)
                </p>
                {getChangedFields(
                  selectedEvent.old_values || {},
                  selectedEvent.new_values || {},
                ).length === 0 ? (
                  <p className="text-xs text-slate-600">
                    No field-level diff available for this event.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {getChangedFields(
                      selectedEvent.old_values || {},
                      selectedEvent.new_values || {},
                    )
                      .slice(0, 12)
                      .map((field) => (
                        <li key={`old-${field.key}`}>
                          <span className="font-semibold">{field.label}:</span>{" "}
                          <span className="text-slate-900">{field.from}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <div className="rounded-[var(--radius-sm)] border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="mb-2 font-semibold text-emerald-800">
                  After (New Values)
                </p>
                {getChangedFields(
                  selectedEvent.old_values || {},
                  selectedEvent.new_values || {},
                ).length === 0 ? (
                  <p className="text-xs text-slate-600">
                    No field-level diff available for this event.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs text-slate-700">
                    {getChangedFields(
                      selectedEvent.old_values || {},
                      selectedEvent.new_values || {},
                    )
                      .slice(0, 12)
                      .map((field) => (
                        <li key={`new-${field.key}`}>
                          <span className="font-semibold">{field.label}:</span>{" "}
                          <span className="text-slate-900">{field.to}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-3 app-card app-card-compact text-sm">
              <p className="mb-1 font-semibold">Snapshot Summary</p>
              <ul className="space-y-1 text-xs text-slate-700">
                <li>
                  Old fields:{" "}
                  <span className="font-semibold">
                    {Object.keys(selectedEvent.old_values || {}).length}
                  </span>
                </li>
                <li>
                  New fields:{" "}
                  <span className="font-semibold">
                    {Object.keys(selectedEvent.new_values || {}).length}
                  </span>
                </li>
                <li>
                  Changed fields:{" "}
                  <span className="font-semibold">
                    {
                      getChangedFields(
                        selectedEvent.old_values || {},
                        selectedEvent.new_values || {},
                      ).length
                    }
                  </span>
                </li>
              </ul>
            </div>

            <details className="mt-4 app-card app-card-compact text-sm">
              <summary className="cursor-pointer font-semibold text-slate-800">
                Raw Metadata (JSON)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
              </pre>
            </details>
            <details className="mt-3 app-card app-card-compact text-sm">
              <summary className="cursor-pointer font-semibold text-slate-800">
                Raw Before/After (JSON)
              </summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                  {JSON.stringify(selectedEvent.old_values || {}, null, 2)}
                </pre>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                  {JSON.stringify(selectedEvent.new_values || {}, null, 2)}
                </pre>
              </div>
            </details>
          </aside>
        </div>
      ) : null}
    </section>
  );
}





