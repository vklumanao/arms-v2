export function registerScorecardRoutes(app, deps) {
  const { authMiddleware, query } = deps;

  function asText(value) {
    return String(value ?? "").trim();
  }

  function canManageScorecards(user) {
    return Boolean(user && user.role === "admin");
  }

  function isCenterChiefForCenter(user, centerId) {
    return (
      Boolean(user?.is_center_chief) &&
      asText(user?.managed_center_id) === asText(centerId)
    );
  }

  function canViewCenterScorecard(user, centerId) {
    if (!user) return false;
    return canManageScorecards(user) || isCenterChiefForCenter(user, centerId);
  }

  function canEditCenterScorecard(user, centerId) {
    if (!user) return false;
    return canManageScorecards(user) || isCenterChiefForCenter(user, centerId);
  }

  async function resolveCenter(centerKey) {
    const trimmed = asText(centerKey);
    if (!trimmed) return null;

    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        trimmed,
      );
    if (looksLikeUuid) {
      const byIdResult = await query(
        `SELECT * FROM research_centers WHERE id = $1 LIMIT 1`,
        [trimmed],
      );
      const byId = byIdResult.rows?.[0] || null;
      if (byId) return byId;
    }

    const byCodeResult = await query(
      `SELECT * FROM research_centers WHERE code = $1 LIMIT 1`,
      [trimmed],
    );
    return byCodeResult.rows?.[0] || null;
  }

  async function getDefaultTemplate() {
    const templateResult = await query(
      `
      SELECT *
      FROM scorecard_templates
      WHERE is_default = TRUE
      ORDER BY created_at ASC
      LIMIT 1
      `,
    );
    const template = templateResult.rows?.[0] || null;
    if (!template) return null;

    const itemsResult = await query(
      `
      SELECT *
      FROM scorecard_template_items
      WHERE template_id = $1
      ORDER BY sort_order ASC, sheet_code ASC
      `,
      [template.id],
    );

    return {
      ...template,
      items: itemsResult.rows || [],
    };
  }

  app.get(
    "/api/scorecards/templates/default",
    authMiddleware,
    async (req, res) => {
      const template = await getDefaultTemplate();
      if (!template) {
        return res.status(404).json({ error: "Default scorecard template not found." });
      }
      return res.json({ data: template });
    },
  );

  app.post(
    "/api/scorecards/centers/:centerId/years/:year",
    authMiddleware,
    async (req, res) => {
      if (!canManageScorecards(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const centerId = asText(req.params.centerId);
      const year = Number(req.params.year);
      if (!centerId || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Invalid center or year." });
      }

      const center = await resolveCenter(centerId);
      if (!center) {
        return res.status(404).json({ error: "Research center not found." });
      }

      const existingResult = await query(
        `SELECT * FROM center_scorecards WHERE center_id = $1 AND year = $2 LIMIT 1`,
        [center.id, year],
      );
      const existing = existingResult.rows?.[0];
      if (existing) {
        return res.json({ data: existing, created: false });
      }

      const template = await getDefaultTemplate();
      if (!template) {
        return res.status(400).json({ error: "Default scorecard template is missing." });
      }

      const scorecardName = `${center.name} Scorecard ${year}`;

      const createdResult = await query(
        `
        INSERT INTO center_scorecards (
          center_id, template_id, year, name, status, created_by
        ) VALUES ($1, $2, $3, $4, 'draft', $5)
        RETURNING *
        `,
        [center.id, template.id, year, scorecardName, req.user.id],
      );
      const scorecard = createdResult.rows?.[0];

      for (const item of template.items || []) {
        await query(
          `
          INSERT INTO center_scorecard_items (
            center_scorecard_id,
            template_item_id,
            sheet_code,
            deliverable,
            target_type,
            target,
            success_indicator,
            weight,
            is_enabled,
            sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          `,
          [
            scorecard.id,
            item.id,
            item.sheet_code,
            item.deliverable,
            item.target_type,
            item.default_target,
            item.success_indicator,
            item.weight,
            item.is_active !== false,
            item.sort_order,
          ],
        );
      }

      return res.status(201).json({
        data: { ...scorecard, itemsCreated: template.items?.length || 0 },
      });
    },
  );

  app.get(
    "/api/scorecards/centers/:centerId/years/:year",
    authMiddleware,
    async (req, res) => {
      const centerId = asText(req.params.centerId);
      const year = Number(req.params.year);
      if (!centerId || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Invalid center or year." });
      }
      const center = await resolveCenter(centerId);
      if (!center) {
        return res.status(404).json({ error: "Research center not found." });
      }
      if (!canViewCenterScorecard(req.user, center.id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const scorecardResult = await query(
        `
        SELECT cs.*, rc.name AS center_name, rc.code AS center_code
        FROM center_scorecards cs
        JOIN research_centers rc ON rc.id = cs.center_id
        WHERE cs.center_id = $1 AND cs.year = $2
        LIMIT 1
        `,
        [center.id, year],
      );
      const scorecard = scorecardResult.rows?.[0];
      if (!scorecard) {
        return res.status(404).json({ error: "Scorecard not found." });
      }

      const itemsResult = await query(
        `
        SELECT
          csi.*,
          COALESCE(SUM(sa.actual_value), 0) AS actual_value,
          COUNT(sa.id) AS accomplishment_count
        FROM center_scorecard_items csi
        LEFT JOIN scorecard_accomplishments sa
          ON sa.center_scorecard_item_id = csi.id
        WHERE csi.center_scorecard_id = $1
        GROUP BY csi.id
        ORDER BY csi.sort_order ASC, csi.sheet_code ASC
        `,
        [scorecard.id],
      );

      return res.json({
        data: {
          ...scorecard,
          items: itemsResult.rows || [],
        },
      });
    },
  );

  app.patch(
    "/api/scorecards/centers/:centerId/years/:year",
    authMiddleware,
    async (req, res) => {
      const centerId = asText(req.params.centerId);
      const year = Number(req.params.year);
      if (!centerId || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Invalid center or year." });
      }
      const center = await resolveCenter(centerId);
      if (!center) {
        return res.status(404).json({ error: "Research center not found." });
      }
      if (!canEditCenterScorecard(req.user, center.id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const scorecardResult = await query(
        `SELECT * FROM center_scorecards WHERE center_id = $1 AND year = $2 LIMIT 1`,
        [center.id, year],
      );
      const scorecard = scorecardResult.rows?.[0];
      if (!scorecard) {
        return res.status(404).json({ error: "Scorecard not found." });
      }
      if (scorecard.status === "locked" || scorecard.status === "archived") {
        return res.status(409).json({ error: "Scorecard is locked." });
      }

      const payload = req.body || {};
      const updatedName = asText(payload.name) || scorecard.name;
      const updatedNotes = payload.notes ?? scorecard.notes ?? null;
      const updatedStatus = asText(payload.status) || scorecard.status;
      const items = Array.isArray(payload.items) ? payload.items : [];

      await query(
        `
        UPDATE center_scorecards
        SET name = $1,
            notes = $2,
            status = $3,
            updated_at = NOW()
        WHERE id = $4
        `,
        [updatedName, updatedNotes, updatedStatus, scorecard.id],
      );

      for (const rawItem of items) {
        const sheetCode = Number(rawItem?.sheet_code);
        if (!Number.isInteger(sheetCode)) continue;

        const existingItemResult = await query(
          `
          SELECT *
          FROM center_scorecard_items
          WHERE center_scorecard_id = $1 AND sheet_code = $2
          LIMIT 1
          `,
          [scorecard.id, sheetCode],
        );
        const existingItem = existingItemResult.rows?.[0];

        const itemValues = [
          asText(rawItem?.deliverable) || existingItem?.deliverable || "",
          asText(rawItem?.target_type) || existingItem?.target_type || "count",
          rawItem?.target ?? existingItem?.target ?? 0,
          asText(rawItem?.success_indicator) || existingItem?.success_indicator || "",
          rawItem?.weight ?? existingItem?.weight ?? 1,
          rawItem?.is_enabled ?? existingItem?.is_enabled ?? true,
          Number.isInteger(rawItem?.sort_order)
            ? rawItem.sort_order
            : existingItem?.sort_order || 0,
          rawItem?.notes ?? existingItem?.notes ?? null,
        ];

        if (existingItem) {
          await query(
            `
            UPDATE center_scorecard_items
            SET deliverable = $1,
                target_type = $2,
                target = $3,
                success_indicator = $4,
                weight = $5,
                is_enabled = $6,
                sort_order = $7,
                notes = $8,
                updated_at = NOW()
            WHERE id = $9
            `,
            [...itemValues, existingItem.id],
          );
        } else {
          await query(
            `
            INSERT INTO center_scorecard_items (
              center_scorecard_id,
              template_item_id,
              sheet_code,
              deliverable,
              target_type,
              target,
              success_indicator,
              weight,
              is_enabled,
              sort_order,
              notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `,
            [
              scorecard.id,
              null,
              sheetCode,
              itemValues[0],
              itemValues[1],
              itemValues[2],
              itemValues[3],
              itemValues[4],
              itemValues[5],
              itemValues[6],
              itemValues[7],
            ],
          );
        }
      }

      const refreshed = await query(
        `
        SELECT cs.*, rc.name AS center_name, rc.code AS center_code
        FROM center_scorecards cs
        JOIN research_centers rc ON rc.id = cs.center_id
        WHERE cs.id = $1
        LIMIT 1
        `,
        [scorecard.id],
      );
      return res.json({ data: refreshed.rows?.[0] || null });
    },
  );

  app.delete(
    "/api/scorecards/centers/:centerId/years/:year/items/:sheetCode",
    authMiddleware,
    async (req, res) => {
      const centerId = asText(req.params.centerId);
      const year = Number(req.params.year);
      const sheetCode = Number(req.params.sheetCode);
      if (!centerId || !Number.isInteger(year) || !Number.isInteger(sheetCode)) {
        return res.status(400).json({ error: "Invalid center, year, or sheet code." });
      }
      const center = await resolveCenter(centerId);
      if (!center) {
        return res.status(404).json({ error: "Research center not found." });
      }
      if (!canEditCenterScorecard(req.user, center.id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const scorecardResult = await query(
        `SELECT * FROM center_scorecards WHERE center_id = $1 AND year = $2 LIMIT 1`,
        [center.id, year],
      );
      const scorecard = scorecardResult.rows?.[0];
      if (!scorecard) {
        return res.status(404).json({ error: "Scorecard not found." });
      }
      if (scorecard.status === "locked" || scorecard.status === "archived") {
        return res.status(409).json({ error: "Scorecard is locked." });
      }

      const deletedResult = await query(
        `
        DELETE FROM center_scorecard_items
        WHERE center_scorecard_id = $1 AND sheet_code = $2
        RETURNING *
        `,
        [scorecard.id, sheetCode],
      );

      if (!deletedResult.rows?.length) {
        return res.status(404).json({ error: "Scorecard item not found." });
      }

      return res.json({ data: { deleted: true, sheet_code: sheetCode } });
    },
  );
}
