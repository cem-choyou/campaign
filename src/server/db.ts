import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

// Neon (pooled URL) in production; plain Postgres when the URL points at a local server
// (dev without Neon, e2e in Docker). See CLAUDE.md §15.
function createAdapter(connectionString: string) {
  const host = new URL(connectionString).hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "postgres";
  return isLocal ? new PrismaPg({ connectionString }) : new PrismaNeon({ connectionString });
}

// Neon suspends idle databases; the first query after wake-up can fail with a terminated
// connection (57P01). Such errors are safe to retry once.
const TRANSIENT = /57P01|terminating connection|Connection terminated|ECONNRESET|socket hang up/i;

export function isTransientDbError(error: unknown): boolean {
  return error instanceof Error && TRANSIENT.test(`${error.message} ${String(error.cause ?? "")}`);
}

function createClient() {
  const base = new PrismaClient({
    adapter: createAdapter(env.DATABASE_URL),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!isTransientDbError(error)) throw error;
          return query(args);
        }
      },
    },
  });
}

export type Db = ReturnType<typeof createClient>;

const globalForDb = globalThis as unknown as { db?: Db };

export const db: Db = globalForDb.db ?? createClient();

if (env.NODE_ENV !== "production") globalForDb.db = db;
