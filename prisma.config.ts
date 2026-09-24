import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env files: use Node's built-in loader (no dotenv dependency).
// ENV_FILE lets e2e/prod commands point at another file (e.g. .env.e2e).
for (const file of [process.env.ENV_FILE, ".env.local", ".env"]) {
  if (file && existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Direct (non-pooled) connection for `db push`. Runtime uses the pooled URL (src/server/db.ts).
    // Not using env() so that `prisma generate` works without a database (Docker build).
    url: process.env.DIRECT_URL ?? "",
  },
});
