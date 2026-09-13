CREATE TYPE "public"."deck_board" AS ENUM('commander', 'main', 'side', 'maybe');--> statement-breakpoint
CREATE TABLE "deck_cards" (
	"deck_id" uuid NOT NULL,
	"board" "deck_board" DEFAULT 'main' NOT NULL,
	"oracle_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"catalog_card_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_cards_deck_id_board_oracle_id_pk" PRIMARY KEY("deck_id","board","oracle_id"),
	CONSTRAINT "deck_cards_quantity_positive" CHECK ("deck_cards"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"format" text DEFAULT 'commander' NOT NULL,
	"description" text,
	"location_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_oracle_id_oracle_cards_oracle_id_fk" FOREIGN KEY ("oracle_id") REFERENCES "public"."oracle_cards"("oracle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_catalog_card_id_catalog_cards_id_fk" FOREIGN KEY ("catalog_card_id") REFERENCES "public"."catalog_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_cards_oracle_idx" ON "deck_cards" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "decks_owner_idx" ON "decks" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decks_location_uq" ON "decks" USING btree ("location_id");