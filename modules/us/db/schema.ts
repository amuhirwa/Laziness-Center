import {
  pgTable, text, boolean, timestamp, integer, numeric, jsonb, uuid, uniqueIndex,
} from "drizzle-orm/pg-core"

export const checklists = pgTable("checklists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  isPinned: boolean("is_pinned").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  checklistId: uuid("checklist_id").notNull().references(() => checklists.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  notes: text("notes"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
  addedBy: text("added_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const wishlistItems = pgTable("wishlist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url"),
  imageUrl: text("image_url"),
  price: numeric("price", { precision: 12, scale: 2 }),
  currency: text("currency"),
  category: text("category"),
  status: text("status").notNull().default("wanted"),
  isPinned: boolean("is_pinned").notNull().default(false),
  addedBy: text("added_by").notNull(),
  statusChangedBy: text("status_changed_by"),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const places = pgTable("places", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  location: text("location"),
  description: text("description"),
  url: text("url"),
  imageUrl: text("image_url"),
  category: text("category"),
  status: text("status").notNull().default("wantToGo"),
  isPinned: boolean("is_pinned").notNull().default(false),
  addedBy: text("added_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const placeVisits = pgTable("place_visits", {
  id: uuid("id").primaryKey().defaultRandom(),
  placeId: uuid("place_id").notNull().references(() => places.id, { onDelete: "cascade" }),
  visitedAt: timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
  rating: integer("rating"),
  notes: text("notes"),
  loggedBy: text("logged_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemType: text("item_type").notNull(),
  itemId: uuid("item_id").notNull(),
  reactor: text("reactor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("reactions_item_reactor_idx").on(table.itemType, table.itemId, table.reactor),
])

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemType: text("item_type").notNull(),
  itemId: uuid("item_id").notNull(),
  body: text("body").notNull(),
  author: text("author").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  section: text("section").notNull(),
  actor: text("actor").notNull(),
  itemType: text("item_type"),
  itemId: uuid("item_id"),
  itemTitle: text("item_title"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
