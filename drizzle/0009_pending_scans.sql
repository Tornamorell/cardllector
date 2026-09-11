CREATE TABLE "pending_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"image" "bytea" NOT NULL,
	"read_text" text,
	"guess" text,
	"finish" "finish" NOT NULL,
	"condition" "card_condition" NOT NULL,
	"language" text NOT NULL,
	"location_id" uuid,
	"collection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_scans" ADD CONSTRAINT "pending_scans_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_scans" ADD CONSTRAINT "pending_scans_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_scans" ADD CONSTRAINT "pending_scans_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_scans_owner_idx" ON "pending_scans" USING btree ("owner_id","created_at");