import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 moved the connection URL out of schema.prisma and into here.
// `prisma migrate`/`db push` use this file directly; the running app instead
// builds its own adapter in src/lib/prisma.ts (see that file for why).
//
// Loaded explicitly from .env.local (not just .env) because that's where the
// Vercel CLI writes pulled env vars (`vercel env pull .env.local`).
config({ path: ".env.local" });

// Neon (via Vercel's Postgres integration) provides DATABASE_URL (pooled,
// pgbouncer) and DATABASE_URL_UNPOOLED (direct). Migrations run better on the
// direct connection — pooled/pgbouncer can be flaky for the schema-changing
// statements migrate uses. Falls back to DATABASE_URL if only that's set.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
