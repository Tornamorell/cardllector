CREATE TABLE "collection_cards" (
	"collection_id" uuid NOT NULL,
	"catalog_card_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_cards_collection_id_catalog_card_id_pk" PRIMARY KEY("collection_id","catalog_card_id"),
	CONSTRAINT "collection_cards_quantity_positive" CHECK ("collection_cards"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_value_snapshots" (
	"owner_id" text NOT NULL,
	"date" date NOT NULL,
	"value_eur" numeric(12, 2) NOT NULL,
	"card_count" integer NOT NULL,
	"unpriced_count" integer NOT NULL,
	CONSTRAINT "inventory_value_snapshots_owner_id_date_pk" PRIMARY KEY("owner_id","date")
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "collection_cards" ADD CONSTRAINT "collection_cards_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_cards" ADD CONSTRAINT "collection_cards_catalog_card_id_catalog_cards_id_fk" FOREIGN KEY ("catalog_card_id") REFERENCES "public"."catalog_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_value_snapshots" ADD CONSTRAINT "inventory_value_snapshots_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_cards_card_idx" ON "collection_cards" USING btree ("catalog_card_id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_owner_idx" ON "items" USING btree ("owner_id");