import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as { usPgClient: postgres.Sql }
const client = globalForDb.usPgClient ?? postgres({
  host: process.env.DB_HOST ?? "postgres",
  port: Number(process.env.DB_PORT ?? "5432"),
  user: "us",
  password: process.env.US_DB_PASSWORD!,
  database: process.env.DB_NAME ?? "laziness",
  onnotice: () => {},
  connection: { search_path: "us" },
})
if (process.env.NODE_ENV !== "production") globalForDb.usPgClient = client

export const db = drizzle(client, { schema })
export { client }
