CREATE TABLE IF NOT EXISTS "dataset_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"checksum" text NOT NULL,
	"source_count" integer NOT NULL,
	"locales" text[] NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding_version" integer NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dataset_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
ALTER TABLE "assistant_rule_sets" ADD COLUMN "locale" text DEFAULT 'es-419' NOT NULL;--> statement-breakpoint
UPDATE "assistant_rule_sets" SET "locale" = 'es-AR';--> statement-breakpoint
ALTER TABLE "chat_examples" ADD COLUMN "embedding_v2" vector(768);--> statement-breakpoint
ALTER TABLE "chat_examples" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "chat_examples" ADD COLUMN "embedding_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_examples" ADD COLUMN "locale" text DEFAULT 'es-AR' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_examples" ADD COLUMN "dataset_version" text DEFAULT 'legacy-2026-07' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_examples" ADD COLUMN "source_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "locale" text DEFAULT 'es-419' NOT NULL;--> statement-breakpoint
DELETE FROM "assistant_rule_sets"
WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", row_number() OVER (
			PARTITION BY "locale", "name", "version"
			ORDER BY "created_at", "id"
		) AS duplicate_number
		FROM "assistant_rule_sets"
	) duplicates
	WHERE duplicate_number > 1
);--> statement-breakpoint
UPDATE "assistant_rule_sets" rules
SET "active" = false
WHERE "active" = true
	AND EXISTS (
		SELECT 1 FROM "assistant_rule_sets" older
		WHERE older."locale" = rules."locale"
			AND older."active" = true
			AND (older."created_at", older."id") < (rules."created_at", rules."id")
	);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_rule_sets_locale_name_version_unique" ON "assistant_rule_sets" USING btree ("locale","name","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_rule_sets_one_active_per_locale" ON "assistant_rule_sets" USING btree ("locale") WHERE "assistant_rule_sets"."active" = true;
