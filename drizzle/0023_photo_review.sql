ALTER TABLE "catalog_card_photos" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "catalog_card_photos" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "catalog_card_photos" ADD CONSTRAINT "catalog_card_photos_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;