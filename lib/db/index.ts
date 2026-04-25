import 'server-only';

import postgres from 'postgres';

import { drizzle } from 'drizzle-orm/postgres-js';

import { config } from '@/config';
import * as schema from '@/lib/db/schema';

type Database = ReturnType<typeof createDb>;

let databaseInstance: Database | null = null;

export function getDb() {
  if (databaseInstance != null) {
    return databaseInstance;
  }

  databaseInstance = createDb();
  return databaseInstance;
}

function createDb() {
  const client = postgres(config.database.url, {
    max: 10,
  });

  return drizzle({ client, schema });
}

export async function closeDb(): Promise<void> {
  if (databaseInstance == null) {
    return;
  }

  const database = databaseInstance;
  databaseInstance = null;
  await database.$client.end();
}
