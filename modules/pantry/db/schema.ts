import { pgTable, serial, text, numeric, timestamp, uuid, jsonb, boolean } from "drizzle-orm/pg-core"

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  nameNormalized: text("name_normalized").notNull().unique(),
  nameDisplay: text("name_display").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  unit: text("unit").notNull(),
  alwaysAvailable: boolean("always_available").notNull().default(false),
  lowStockThreshold: numeric("low_stock_threshold", { precision: 10, scale: 3 }),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
})

export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemsJson: jsonb("items_json").notNull().$type<Array<{
    name: string; quantity: number; unit: string; unitPrice: number
  }>>(),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("RWF"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const consumptionLog = pgTable("consumption_log", {
  id: serial("id").primaryKey(),
  nameNormalized: text("name_normalized").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }),
  unit: text("unit"),
  // 'recipe' = deducted successfully, 'recipe-partial' = skipped (unit mismatch / not found), 'manual'
  source: text("source").notNull(),
  sourceRef: text("source_ref"),
  notes: text("notes"),
  consumedAt: timestamp("consumed_at", { withTimezone: true }).notNull().defaultNow(),
})

export const processedEvents = pgTable("processed_events", {
  eventId: text("event_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
})
