import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const databaseUrl = process.env.DATABASE_URL?.trim() || 'file:.data/agents.sqlite';
const migrationsFolder = path.join(process.cwd(), 'drizzle');

ensureDatabaseDirectory(databaseUrl);

const client = createClient({
  url: databaseUrl,
});

const db = drizzle(client);

try {
  await migrate(db, {
    migrationsFolder,
  });
} finally {
  await client.close();
}

function ensureDatabaseDirectory(url) {
  const filePath = toSqliteFilePath(url);
  const directory = path.dirname(filePath);

  if (directory === '.' || directory.length === 0) {
    return;
  }

  mkdirSync(directory, { recursive: true });
}

function toSqliteFilePath(url) {
  return url.startsWith('file:') ? url.slice('file:'.length) : url;
}
