import { pgSchema, uuid, text } from "drizzle-orm/pg-core";

export const accountsSchema = pgSchema("accounts");

export const users = accountsSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  display_name: text("display_name").notNull(),
  role: text("role").default("user").notNull(),
  vault_path: text("vault_path"),
  last_opened_files: text("last_opened_files"),
});
