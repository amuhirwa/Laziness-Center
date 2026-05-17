import { z } from "zod"

const WidgetSchema = z.object({
  id: z.string(),
  endpoint: z.string(),
  refresh_seconds: z.number().int().positive().default(3600),
})

const PublishesEntrySchema = z.object({
  name: z.string(),
  transport: z.enum(["pubsub", "stream"]),
})

export const ManifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "id must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  type: z.enum(["proxy_subpath", "iframe", "linked"]),
  url: z.string().min(1),
  // Full internal URL, e.g. http://module-name:8000/api — used for inter-module calls and health checks
  internal_api: z.string().url().optional(),
  // Full URL to the health endpoint, e.g. http://module-name:8000/health
  // Must be a full http(s) URL — relative paths are not supported for internal health checks
  health_check: z.string().url().optional(),
  // Identifiers (email or name) of users who don't see this module by default
  default_hidden: z.array(z.string()).default([]),
  widgets: z.array(WidgetSchema).default([]),
  events: z
    .object({
      publishes: z.array(PublishesEntrySchema).default([]),
      subscribes: z.array(z.string()).default([]),
    })
    .default({ publishes: [], subscribes: [] }),
})

export type Manifest = z.infer<typeof ManifestSchema>
