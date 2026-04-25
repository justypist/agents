import path from 'node:path';

import postgres from 'postgres';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  'postgres://agents:agents@localhost:5432/agents';
const migrationsFolder = path.join(process.cwd(), 'drizzle');

const client = postgres(databaseUrl, {
  max: 1,
  onnotice: () => {},
});

const db = drizzle(client);

try {
  await migrate(db, {
    migrationsFolder,
  });
} finally {
  await client.end();
}
