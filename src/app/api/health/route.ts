import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// Used by the Docker HEALTHCHECK. The database ping is bounded so a sleeping Neon branch does
// not mark the container unhealthy.
export async function GET() {
  const started = Date.now();
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);
    return Response.json({ status: "ok", db: "ok", ms: Date.now() - started });
  } catch {
    return Response.json({ status: "degraded", db: "unreachable" }, { status: 503 });
  }
}
