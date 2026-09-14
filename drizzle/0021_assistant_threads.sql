CREATE TABLE "ai_chat_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chat_turns" ADD COLUMN "thread_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_thread_id_ai_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_threads" ADD CONSTRAINT "ai_chat_threads_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_chat_messages_thread_idx" ON "ai_chat_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_chat_threads_owner_idx" ON "ai_chat_threads" USING btree ("owner_id","updated_at");--> statement-breakpoint
ALTER TABLE "ai_chat_turns" ADD CONSTRAINT "ai_chat_turns_thread_id_ai_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_chat_threads"("id") ON DELETE set null ON UPDATE no action;