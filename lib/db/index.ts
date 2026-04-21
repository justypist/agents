import 'server-only';

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';

import { drizzle } from 'drizzle-orm/libsql';

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
  const databasePath = toSqliteFilePath(config.database.url);

  ensureDatabaseDirectory(databasePath);

  const client = createClient({
    url: config.database.url,
  });

  return drizzle({ client, schema });
}

function ensureDatabaseDirectory(databaseUrl: string): void {
  const directory = path.dirname(databaseUrl);

  if (directory === '.' || directory.length === 0) {
    return;
  }

  mkdirSync(directory, { recursive: true });
}

function toSqliteFilePath(databaseUrl: string): string {
  return databaseUrl.startsWith('file:')
    ? databaseUrl.slice('file:'.length)
    : databaseUrl;
}
