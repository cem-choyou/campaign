// Resets the e2e database, seeds it and creates one session per role.
// Run by global-setup.ts through tsx (the generated Prisma client is ESM).
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { E2E, SESSIONS_FILE } from "./config";

if (!/_e2e(\?|$)/.test(new URL(E2E.databaseUrl).pathname + new URL(E2E.databaseUrl).search)) {
  throw new Error("Refus : la base e2e doit se terminer par _e2e.");
}

const env = { ...process.env, DATABASE_URL: E2E.databaseUrl, DIRECT_URL: E2E.databaseUrl };
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: E2E.databaseUrl }) });

async function main() {
  await db.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await db.$executeRawUnsafe("CREATE SCHEMA public");
  execSync("npx prisma db push", { env, stdio: "ignore" });
  execSync("npx tsx prisma/seed.ts", {
    env: { ...env, SEED_DEMO_START: E2E.demoStart },
    stdio: "ignore",
  });

  const brand = await db.brand.findUniqueOrThrow({ where: { slug: "it-for-business" } });
  const other = await db.brand.create({ data: { name: "Autre marque", slug: "autre-marque" } });
  await db.campaign.create({
    data: {
      brandId: other.id,
      name: "Campagne confidentielle",
      createdById: "seed",
      wizardStep: 5,
    },
  });

  const expires = new Date(Date.now() + 30 * 86_400_000);
  const sessions: Record<string, string> = {};
  const roles = [
    { key: "admin", email: "cem@choyou.fr", role: null },
    { key: "editor", email: "editeur@choyou.fr", name: "Éva Éditrice", role: "EDITOR" as const },
    { key: "client", email: "client@exemple.fr", name: "Claire Cliente", role: "CLIENT" as const },
  ];
  for (const r of roles) {
    const user = await db.user.upsert({
      where: { email: r.email },
      create: { email: r.email, name: r.name ?? null },
      update: {},
    });
    if (r.role) {
      await db.membership.create({ data: { userId: user.id, brandId: brand.id, role: r.role } });
    }
    const token = `e2e-${r.key}-${crypto.randomUUID()}`;
    await db.session.create({ data: { sessionToken: token, userId: user.id, expires } });
    sessions[r.key] = token;
  }

  mkdirSync("playwright/.auth", { recursive: true });
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
