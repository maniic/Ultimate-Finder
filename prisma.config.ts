// Prisma CLI config (Prisma 7). DATABASE_URL comes from the environment:
// compose.yaml sets it locally, and the server sets it in production.
// Never put a real connection string in this file. The repo is public.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema',            // one .prisma file per feature
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
