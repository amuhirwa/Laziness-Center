import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// In dev, Next.js hot-reloads can spawn multiple postgres clients.
// Cache the client on globalThis to avoid exhausting the connection pool.
const globalForDb = globalThis as unknown as { pgClient: postgres.Sql }

const client = globalForDb.pgClient ?? postgres(process.env.DATABASE_URL!)
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client

export const db = drizzle(client, { schema })
export { client }
