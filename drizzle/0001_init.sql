CREATE TYPE "public"."card_condition" AS ENUM('MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO');--> statement-breakpoint
CREATE TYPE "public"."finish" AS ENUM('nonfoil', 'foil', 'etched');--> statement-breakpoint
CREATE TYPE "public"."game" AS ENUM('mtg', 'pokemon', 'sports');--> statement-breakpoint
CREATE TYPE "public"."item_source" AS ENUM('manual', 'scan');--> statement-breakpoint
CREATE TABLE "card_names" (
	"catalog_card_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"printed_name" text NOT NULL,
	"search_name" text NOT NULL,
	CONSTRAINT "card_names_catalog_card_id_lang_pk" PRIMARY KEY("catalog_card_id","lang")
);
--> statement-breakpoint
CREATE TABLE "catalog_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game" "game" NOT NULL,
	"external_id" text NOT NULL,
	"oracle_id" text,
	"name" text NOT NULL,
	"search_name" text NOT NULL,
	"set_code" text NOT NULL,
	"collector_number" text NOT NULL,
	"rarity" text,
	"type_line" text,
	"finishes" text[] DEFAULT '{}'::text[] NOT NULL,
	"image_small" text,
	"image_normal" text,
	"released_at" date,
	"cardmarket_id" integer,
	"price_eur" numeric(10, 2),
	"price_eur_foil" numeric(10, 2),
	"price_usd" numeric(10, 2),
	"price_usd_foil" numeric(10, 2),
	"prices_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collection_value_snapshots" (
	"collection_id" uuid NOT NULL,
	"date" date NOT NULL,
	"value_eur" numeric(12, 2) NOT NULL,
	"card_count" integer NOT NULL,
	"unpriced_count" integer NOT NULL,
	CONSTRAINT "collection_value_snapshots_collection_id_date_pk" PRIMARY KEY("collection_id","date")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"catalog_card_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"finish" "finish" DEFAULT 'nonfoil' NOT NULL,
	"condition" "card_condition" DEFAULT 'NM' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"grading_company" text,
	"grade" numeric(3, 1),
	"purchase_price_eur" numeric(10, 2),
	"purchased_at" date,
	"location" text,
	"notes" text,
	"attributes" jsonb,
	"source" "item_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_quantity_positive" CHECK ("items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"catalog_card_id" uuid NOT NULL,
	"date" date NOT NULL,
	"eur" numeric(10, 2),
	"eur_foil" numeric(10, 2),
	"usd" numeric(10, 2),
	"usd_foil" numeric(10, 2),
	CONSTRAINT "price_snapshots_catalog_card_id_date_pk" PRIMARY KEY("catalog_card_id","date")
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game" "game" NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"set_type" text,
	"parent_set_code" text,
	"released_at" date,
	"icon_uri" text,
	"card_count" integer
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_names" ADD CONSTRAINT "card_names_catalog_card_id_catalog_cards_id_fk" FOREIGN KEY ("catalog_card_id") REFERENCES "public"."catalog_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_value_snapshots" ADD CONSTRAINT "collection_value_snapshots_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_catalog_card_id_catalog_cards_id_fk" FOREIGN KEY ("catalog_card_id") REFERENCES "public"."catalog_cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_catalog_card_id_catalog_cards_id_fk" FOREIGN KEY ("catalog_card_id") REFERENCES "public"."catalog_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_names_search_trgm_idx" ON "card_names" USING gin ("search_name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_cards_game_external_uq" ON "catalog_cards" USING btree ("game","external_id");--> statement-breakpoint
CREATE INDEX "catalog_cards_set_number_idx" ON "catalog_cards" USING btree ("game","set_code","collector_number");--> statement-breakpoint
CREATE INDEX "catalog_cards_oracle_idx" ON "catalog_cards" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "catalog_cards_search_trgm_idx" ON "catalog_cards" USING gin ("search_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "collections_owner_idx" ON "collections" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "items_collection_idx" ON "items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "items_catalog_card_idx" ON "items" USING btree ("catalog_card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sets_game_code_uq" ON "sets" USING btree ("game","code");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");