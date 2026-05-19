import { pgTable, text, boolean, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  email: text("email").primaryKey(),
  name: text("name"),
  role: text("role").notNull().default("user").$type<"admin" | "user">(),
  last_login: timestamp("last_login", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const modules = pgTable("modules", {
  id: text("id").primaryKey(),
  manifest_yaml: text("manifest_yaml").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  last_health_check: timestamp("last_health_check", { withTimezone: true }),
  last_health_status: text("last_health_status").$type<"up" | "down">(),
})

export const userPreferences = pgTable("user_preferences", {
  user_id: text("user_id").notNull(),
  key: text("key").notNull(),
  value_json: jsonb("value_json"),
}, (table) => [
  primaryKey({ columns: [table.user_id, table.key] }),
])

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  source_module: text("source_module"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  read_at: timestamp("read_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
