import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

// Prisma 7 requires an explicit driver adapter — no more built-in query engine
// binary. We use Neon's adapter (HTTP-based) since the target database is Neon
// Postgres and this app runs on Vercel's serverless functions, where
// short-lived HTTP connections behave better than pooled TCP.
//
// The client is created lazily (on first use, not on import) so that
// `next build` doesn't fail in environments where DATABASE_URL isn't set yet
// (e.g. local dev before the Vercel Postgres database is attached) — Next
// imports every route module during its build-time page analysis regardless
// of whether the handler ever runs.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy it from the Vercel project's Storage tab " +
        "(or run `npx vercel env pull .env.local`) into .env.local for local dev."
    );
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver);
  },
});
