-- Free-text items.location becomes locations rows + items.location_id (D20).
INSERT INTO "locations" ("owner_id", "name")
SELECT DISTINCT ON (c."owner_id", lower(trim(i."location"))) c."owner_id", trim(i."location")
FROM "items" i
JOIN "collections" c ON c."id" = i."collection_id"
WHERE i."location" IS NOT NULL AND trim(i."location") <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "items" i
SET "location_id" = l."id"
FROM "collections" c, "locations" l
WHERE c."id" = i."collection_id"
  AND l."owner_id" = c."owner_id"
  AND i."location" IS NOT NULL
  AND lower(l."name") = lower(trim(i."location"));
