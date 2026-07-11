CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"system_prompt" text NOT NULL,
	"rules" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"situational_context" text NOT NULL,
	"last_message" text NOT NULL,
	"psychological_analysis" text NOT NULL,
	"options" jsonb NOT NULL,
	"searchable_text" text NOT NULL,
	"platform" text,
	"goal" text,
	"strategy_tags" text[],
	"investment_level" text,
	"intensity" text,
	"quality_score" numeric(3, 2) DEFAULT '1.00',
	"embedding" vector(768) NOT NULL,
	"source_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_examples_source_hash_unique" UNIQUE("source_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"chat_id" uuid,
	"input_snapshot" jsonb NOT NULL,
	"controls" jsonb NOT NULL,
	"detected_category" text NOT NULL,
	"retrieved_example_ids" uuid[],
	"retrieval_scores" jsonb NOT NULL,
	"rule_set_id" uuid,
	"model" text NOT NULL,
	"result" jsonb NOT NULL,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "response_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_run_id" uuid,
	"option_type" text NOT NULL,
	"option_text" text NOT NULL,
	"feedback" text NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_rule_set_id_assistant_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."assistant_rule_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "response_feedback" ADD CONSTRAINT "response_feedback_generation_run_id_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
