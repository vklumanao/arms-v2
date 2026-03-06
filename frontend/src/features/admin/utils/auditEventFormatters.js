const ENTITY_LABELS = {
  project: "Project Submission",
  profile: "User Profile",
  research_center: "Research Center",
  research_agenda: "Research Agenda",
  department: "Department",
  center: "Research Center",
  agenda: "Research Agenda",
  project_reviewer_assignments: "Reviewer Assignment",
  notifications: "Notification",
};

export function toEntityLabel(entityType) {
  return ENTITY_LABELS[entityType] || entityType || "Unknown";
}

export function shortId(value) {
  if (!value) return "-";
  const text = String(value);
  return text.length > 12 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

export function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatFieldLabel(key) {
  if (!key) return "-";
  return key.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function getChangedFields(oldValues = {}, newValues = {}) {
  const keys = [
    ...new Set([...Object.keys(oldValues), ...Object.keys(newValues)]),
  ];
  return keys
    .filter(
      (key) =>
        JSON.stringify(oldValues?.[key]) !== JSON.stringify(newValues?.[key]),
    )
    .map((key) => ({
      key,
      label: formatFieldLabel(key),
      from: formatValue(oldValues?.[key]),
      to: formatValue(newValues?.[key]),
    }));
}

export function describeAuditEvent(row) {
  const entityLabel = toEntityLabel(row.entity_type);
  const entityRef = row.entity_id ? ` (${shortId(row.entity_id)})` : "";
  const action = row.action_type || "";
  const meta = row.metadata || {};
  const oldValues = row.old_values || {};
  const newValues = row.new_values || {};

  if (action === "submission_approved") {
    return `Approved a project submission${entityRef}.`;
  }
  if (action === "submission_rejected") {
    return `Rejected a project submission${entityRef}.`;
  }
  if (action === "reviewer_assigned") {
    return `Assigned a reviewer to project${entityRef}.`;
  }
  if (action === "reviewer_unassigned") {
    return `Removed reviewer assignment from project${entityRef}.`;
  }
  if (action === "role_change") {
    return `Changed user role from ${formatValue(meta.old_role)} to ${formatValue(meta.new_role)}${entityRef}.`;
  }
  if (action === "profile_security_updated") {
    return `Updated profile security settings${entityRef} (role/status).`;
  }
  if (action === "profile_updated") {
    return `Updated profile details${entityRef}.`;
  }
  if (action === "project_visibility_updated") {
    return `Changed project visibility to ${meta.new ? "public" : "private"}${entityRef}.`;
  }
  if (action === "review_approved") {
    return `Approved project review${entityRef}.`;
  }
  if (action === "review_rejected") {
    return `Rejected project review${entityRef}.`;
  }
  if (action === "dependencies_reassigned") {
    return `Reassigned ${formatValue(row.entity_type)} dependencies to another record.`;
  }

  if (action.endsWith("_insert")) {
    return `Created ${entityLabel}${entityRef}.`;
  }
  if (action.endsWith("_delete")) {
    return `Deleted ${entityLabel}${entityRef}.`;
  }
  if (action.endsWith("_update")) {
    const changedKeys = getChangedFields(oldValues, newValues).map(
      (field) => field.key,
    );
    const keyText =
      changedKeys.length > 0
        ? ` Updated: ${changedKeys.slice(0, 4).join(", ")}.`
        : "";
    return `Updated ${entityLabel}${entityRef}.${keyText}`;
  }

  return `Performed ${action || "an action"} on ${entityLabel}${entityRef}.`;
}

export function formatEntityDisplay(row) {
  const label = toEntityLabel(row.entity_type);
  if (!row.entity_id) return label;
  return `${label} (${shortId(row.entity_id)})`;
}

export function formatRequestDisplay(row) {
  const source = row?.metadata?.source;
  if (row?.request_id) {
    return `API request ${shortId(row.request_id)}`;
  }
  if (source === "sql_editor") {
    return "Manual SQL editor execution";
  }
  if (source === "service_role") {
    return "Service role execution";
  }
  if (source === "api") {
    return "API execution (no request id)";
  }
  return "System/internal execution";
}

export function toIsoDateEnd(value) {
  if (!value) return null;
  return `${value}T23:59:59.999Z`;
}

