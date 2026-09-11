-- Copies stop belonging to collections (D23): they belong to their owner, and collections
-- become lists of cards. Existing data is carried over.

-- 1. Each copy's owner is its collection's owner.
UPDATE "items" i SET "owner_id" = c."owner_id"
FROM "collections" c
WHERE c."id" = i."collection_id" AND i."owner_id" IS NULL;
--> statement-breakpoint
-- 2. What a collection held becomes its list, wanting as many copies as it had.
INSERT INTO "collection_cards" ("collection_id", "catalog_card_id", "quantity")
SELECT "collection_id", "catalog_card_id", LEAST(SUM("quantity"), 999)::int
FROM "items"
WHERE "catalog_card_id" IS NOT NULL
GROUP BY "collection_id", "catalog_card_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- 3. Per-collection value history becomes per-owner inventory history.
INSERT INTO "inventory_value_snapshots" ("owner_id", "date", "value_eur", "card_count", "unpriced_count")
SELECT c."owner_id", s."date", SUM(s."value_eur"), SUM(s."card_count")::int, SUM(s."unpriced_count")::int
FROM "collection_value_snapshots" s
JOIN "collections" c ON c."id" = s."collection_id"
GROUP BY c."owner_id", s."date"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- 4. Stacks that only differed by collection are now identical: merge them (only plain ones,
-- so no notes or purchase prices are lost).
WITH g AS (
  SELECT (array_agg("id" ORDER BY "created_at"))[1] AS keep_id, array_agg("id") AS ids, SUM("quantity")::int AS qty
  FROM "items"
  WHERE "grading_company" IS NULL AND "notes" IS NULL AND "purchase_price_eur" IS NULL
  GROUP BY "owner_id", "catalog_card_id", "finish", "condition", "language", "location_id"
  HAVING COUNT(*) > 1
), merged AS (
  UPDATE "items" i SET "quantity" = g.qty FROM g WHERE i."id" = g.keep_id
)
DELETE FROM "items" i USING g WHERE i."id" = ANY(g.ids) AND i."id" <> g.keep_id;
