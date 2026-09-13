CREATE TABLE "oracle_cards" (
	"oracle_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"search_name" text NOT NULL,
	"front_search_name" text NOT NULL,
	"layout" text,
	"mana_cost" text,
	"cmc" numeric(6, 1) DEFAULT 0 NOT NULL,
	"colors" text[] DEFAULT '{}'::text[] NOT NULL,
	"color_identity" text[] DEFAULT '{}'::text[] NOT NULL,
	"type_line" text,
	"oracle_text" text,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"produced_mana" text[] DEFAULT '{}'::text[] NOT NULL,
	"legalities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"game_changer" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oracle_cards_search_idx" ON "oracle_cards" USING btree ("search_name");--> statement-breakpoint
CREATE INDEX "oracle_cards_front_search_idx" ON "oracle_cards" USING btree ("front_search_name");