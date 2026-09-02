import { pgSchema, uuid, text, timestamp, boolean, bigint } from "drizzle-orm/pg-core";

export const accountsSchema = pgSchema("accounts");
export const workspaceSchema = pgSchema("workspace");

export const users = accountsSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  display_name: text("display_name").notNull(),
  role: text("role").default("user").notNull(),
});

export const pages = workspaceSchema.table("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner_id: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parent_id: uuid("parent_id"), // self-reference to pages.id
  title: text("title").notNull().default("Untitled page"),
  icon: text("icon"),
  content: text("content"), // JSON stringified content
  is_favorite: boolean("is_favorite").default(false),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const files = workspaceSchema.table("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner_id: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  original_name: text("original_name").notNull(),
  storage_name: text("storage_name").notNull(),
  mime_type: text("mime_type").notNull(),
  size_bytes: bigint("size_bytes", { mode: "number" }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
