export const REFERENCE_CONFIG = {
  center: {
    table: "research_centers",
    label: "Research center",
    entity: "research_center",
  },
  agenda: {
    table: "research_agendas",
    label: "Research agenda",
    entity: "research_agenda",
  },
  department: {
    table: "departments",
    label: "Department",
    entity: "department",
  },
  proponent: {
    table: "proponents",
    label: "Proponent",
    entity: "proponent",
  },
};

export function getRefMeta(type) {
  return REFERENCE_CONFIG[type] || REFERENCE_CONFIG.department;
}

export function buildReferenceLabelById({
  centers,
  agendas,
  departments,
  proponents,
}) {
  const map = {};
  [
    ...(centers || []),
    ...(agendas || []),
    ...(departments || []),
    ...(proponents || []),
  ].forEach((row) => {
    if (row?.id) map[row.id] = row.name || row.id;
  });
  return map;
}

export function getReassignEntityLabel(entityType) {
  if (entityType === "center") return "research center";
  if (entityType === "agenda") return "research agenda";
  if (entityType === "department") return "department";
  return "record";
}

export function buildCenterPayload(name) {
  return {
    name,
    code: name.toUpperCase().replace(/\s+/g, "_"),
  };
}

