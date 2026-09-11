ALTER TABLE "collection_value_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "collection_value_snapshots" CASCADE;--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_collection_id_collections_id_fk";
--> statement-breakpoint
DROP INDEX "items_collection_idx";--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "collection_id";