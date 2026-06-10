function asText(value) {
  return String(value ?? "").trim();
}

function pickCenterCode(organization) {
  return (
    asText(organization?.name) ||
    asText(organization?.id) ||
    asText(
      Array.isArray(organization?.extras)
        ? organization.extras.find(
            (item) =>
              String(item?.key || "").trim().toLowerCase() === "code",
          )?.value
        : "",
    )
  ).toLowerCase();
}

function pickCenterName(organization) {
  return (
    asText(organization?.title) ||
    asText(organization?.display_name) ||
    asText(organization?.name) ||
    asText(organization?.id)
  );
}

function pickCenterDescription(organization) {
  const extras = Array.isArray(organization?.extras) ? organization.extras : [];
  const extraDescription =
    extras.find(
      (item) =>
        String(item?.key || "").trim().toLowerCase() === "description",
    )?.value || "";
  return asText(organization?.description) || asText(extraDescription) || null;
}

export async function syncResearchCentersFromOrganizations({
  query,
  listOrganizations,
}) {
  const organizations = await listOrganizations();
  const rows = Array.isArray(organizations) ? organizations : [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const organization of rows) {
    const code = pickCenterCode(organization);
    const name = pickCenterName(organization);
    if (!code || !name) {
      skipped += 1;
      continue;
    }

    const description = pickCenterDescription(organization);
    const existingResult = await query(
      `SELECT id, name, description, is_active FROM research_centers WHERE code = $1 LIMIT 1`,
      [code],
    );
    const existing = existingResult.rows?.[0] || null;

    if (!existing) {
      await query(
        `
        INSERT INTO research_centers (code, name, description, is_active)
        VALUES ($1, $2, $3, TRUE)
        `,
        [code, name, description],
      );
      created += 1;
      continue;
    }

    const nextName = name || existing.name;
    const nextDescription =
      description !== null ? description : existing.description;
    await query(
      `
      UPDATE research_centers
      SET name = $2,
          description = $3,
          updated_at = NOW()
      WHERE code = $1
      `,
      [code, nextName, nextDescription],
    );
    updated += 1;
  }

  return {
    total: rows.length,
    created,
    updated,
    skipped,
  };
}
