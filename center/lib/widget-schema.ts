import { z } from "zod"

// The contract every module widget endpoint must satisfy.
// Center owns rendering; modules own data.
export const WidgetPayloadSchema = z.object({
  title: z.string(),
  primary: z.string(),
  secondary: z.string().optional(),
  sparkline: z.array(z.number()).optional(), // last-N values for a small trend line
  link: z.string().optional(),              // deep link into the module
})

export type WidgetPayload = z.infer<typeof WidgetPayloadSchema>
