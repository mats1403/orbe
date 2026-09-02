ALTER TABLE "accounts"."users" ADD COLUMN "username" text NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts"."users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");