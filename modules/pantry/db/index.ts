import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as { pgClient: postgres.Sql }
const client = globalForDb.pgClient ?? postgres({
  host: process.env.DB_HOST ?? "postgres",
  port: Number(process.env.DB_PORT ?? "5432"),
  user: "pantry",
  password: process.env.PANTRY_DB_PASSWORD!,
  database: process.env.DB_NAME ?? "laziness",
  onnotice: () => {},
  connection: { search_path: "pantry" },
})
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client

export const db = drizzle(client, { schema })
export { client }
