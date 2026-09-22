import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 moved the connection URL out of schema.prisma and into here.
// `prisma migrate`/`db push` use this file directly; the running app instead
// builds its own adapter in src/lib/prisma.ts (see that file for why).
//
// DIRECT_URL (non-pooled) is preferred for migrations when available — Neon's
// pooled connection string (DATABASE_URL, pgbouncer) can be flaky for the
// schema-changing statements migrations run. Falls back to DATABASE_URL if
// DIRECT_URL isn't set (e.g. plain Postgres without separate pooling).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
