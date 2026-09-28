import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { resolveCliDatabaseUrl } from "./scripts/cli-database-url";

// Load .env.local first (dev defaults), then .env as fallback
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "prisma/seed.ts",
  },
  datasource: {
    // Read by every Prisma CLI command (migrate deploy/dev/reset, db push,
    // db execute, studio, generate) and by nothing at runtime. Prefers the
    // direct connection, refuses a direct URL that names a different database
    // than DATABASE_URL, and refuses the pooler in production builds. Why each
    // rule exists is in scripts/cli-database-url.ts.
    url: resolveCliDatabaseUrl(process.env),
  },
});
