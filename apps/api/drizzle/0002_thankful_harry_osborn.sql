DROP TABLE "workspace"."files" CASCADE;--> statement-breakpoint
DROP TABLE "workspace"."pages" CASCADE;--> statement-breakpoint
ALTER TABLE "accounts"."users" ADD COLUMN "vault_path" text;--> statement-breakpoint
ALTER TABLE "accounts"."users" ADD COLUMN "last_opened_files" text;--> statement-breakpoint
DROP SCHEMA "workspace";
