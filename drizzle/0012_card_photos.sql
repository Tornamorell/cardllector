CREATE TABLE "catalog_card_photos" (
	"catalog_card_id" uuid PRIMARY KEY NOT NULL,
	"image" "bytea" NOT NULL,
	"contributed_by" text,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_card_photos" ADD CONSTRAINT "catalog_card_photos_catalog_card_id_catalog_cards_id_fk" FOREIGN KEY ("catalog_card_id") REFERENCES "public"."catalog_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_card_photos" ADD CONSTRAINT "catalog_card_photos_contributed_by_user_id_fk" FOREIGN KEY ("contributed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;