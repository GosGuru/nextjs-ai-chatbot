ALTER TABLE "response_feedback" ADD COLUMN "event" text;--> statement-breakpoint
UPDATE "response_feedback" SET "event" = "feedback" WHERE "event" IS NULL;--> statement-breakpoint
ALTER TABLE "response_feedback" ALTER COLUMN "event" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "response_feedback_generation_run_idx" ON "response_feedback" USING btree ("generation_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "response_feedback_event_created_at_idx" ON "response_feedback" USING btree ("event","created_at");
