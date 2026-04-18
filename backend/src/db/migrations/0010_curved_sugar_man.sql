ALTER TABLE "users" ALTER COLUMN "refresh_token" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "previous_refresh_token" varchar(512);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "previous_refresh_token_expires_at" timestamp;