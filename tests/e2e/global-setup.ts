import { execSync } from "node:child_process";

export default async function globalSetup() {
  execSync("npx tsx tests/e2e/setup-db.ts", { stdio: "inherit" });
}
