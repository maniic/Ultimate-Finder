// One shared Prisma client for the whole server.
//
//   import { prisma } from './db.js';
//   const reports = await prisma.facilityReport.findMany({ ... });
//
// The client is generated from prisma/schema.prisma into generated/prisma/
// (`npm run db:generate`, which the Docker image and compose.dev.yml run for
// you). DATABASE_URL comes from the environment and is never in the repo.

import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Run the app with `docker compose -f compose.dev.yml up` (see CONTRIBUTING.md).');
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 5,                       // small pool: one tiny Postgres, one app
    connectionTimeoutMillis: 3000,
  }),
});

// Is the database reachable? Used by /healthz.
export async function dbHealthy() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    return true;
  } catch {
    return false;
  }
}
