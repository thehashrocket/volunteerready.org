import { config } from "dotenv";
import { defineConfig } from "prisma/config";

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
    url: process.env.DATABASE_URL,
  },
});
