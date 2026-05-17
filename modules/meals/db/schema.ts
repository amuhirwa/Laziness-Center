import {
  pgTable, uuid, text, integer, boolean, jsonb,
  timestamp, serial, numeric, primaryKey,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export type Step = { text: string; durationMinutes?: number }
export type Ingredient = { name: string; quantity: number | null; unit: string | null }

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timeMinutes: integer("time_minutes"),
  servingsDefault: integer("servings_default").notNull().default(2),
  difficulty: text("difficulty").$type<"easy" | "medium" | "hard">(),
  isPinned: boolean("is_pinned").notNull().default(false),
  steps: jsonb("steps").notNull().default(sql`'[]'::jsonb`).$type<Step[]>(),
  hasStructuredSteps: boolean("has_structured_steps").notNull().default(false),
  ingredients: jsonb("ingredients").notNull().default(sql`'[]'::jsonb`).$type<Ingredient[]>(),
  mealTypes: text("meal_types").array().notNull().default(sql`ARRAY[]::text[]`),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  sourceUrl: text("source_url"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const cookedLog = pgTable("cooked_log", {
  id: serial("id").primaryKey(),
  recipeId: uuid("recipe_id").notNull(),
  userId: text("user_id").notNull(),
  cookedAt: timestamp("cooked_at", { withTimezone: true }).notNull().defaultNow(),
  actualMinutes: integer("actual_minutes"),
  actualServings: integer("actual_servings"),
  rating: integer("rating"),
  notes: text("notes"),
})

export const cookSessions = pgTable("cook_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  recipeId: uuid("recipe_id").notNull(),
  servings: integer("servings").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
})

export const suggestionCache = pgTable(
  "suggestion_cache",
  {
    userId: text("user_id").notNull(),
    mealtimeBucket: text("mealtime_bucket").notNull(),
    suggestionsJson: jsonb("suggestions_json").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mealtimeBucket] })]
)
