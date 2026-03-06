export function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    const v = String(val ?? "");
    if (v.includes(",") || v.includes("\n") || v.includes('"')) {
      return `"${v.replaceAll('"', '""')}"`;
    }
    return v;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

