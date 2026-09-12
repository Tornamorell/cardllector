CREATE TABLE "location_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_sections_capacity_positive" CHECK ("location_sections"."capacity" is null or "location_sections"."capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "section_capacity" integer;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "auto_advance" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_scans" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "location_sections" ADD CONSTRAINT "location_sections_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "location_sections_position_uq" ON "location_sections" USING btree ("location_id","position");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_section_id_location_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."location_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_scans" ADD CONSTRAINT "pending_scans_section_id_location_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."location_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_section_idx" ON "items" USING btree ("section_id");