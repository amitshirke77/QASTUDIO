ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_google" ON "users" USING btree ("google_sub");