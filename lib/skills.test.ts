/** @vitest-environment node */

import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SkillsModule = typeof import('./skills');
type DbModule = typeof import('@/lib/db');

let generatedIdCount = 0;

vi.mock('ai', () => ({
  generateId: vi.fn(() => {
    generatedIdCount += 1;
    return `skill-${generatedIdCount}`;
  }),
}));

let previousDatabaseUrl: string | undefined;
let testDatabaseUrl: string;
let testSchemaName: string | null = null;
let loadedDbModule: DbModule | null = null;

beforeEach(() => {
  vi.resetModules();
  generatedIdCount = 0;
  previousDatabaseUrl = process.env.DATABASE_URL;
  testDatabaseUrl =
    process.env.TEST_DATABASE_URL?.trim() ||
    'postgres://agents:agents@localhost:5432/agents';
  testSchemaName = `skills_test_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  process.env.DATABASE_URL = withSearchPath(testDatabaseUrl, testSchemaName);
});

afterEach(async () => {
  await loadedDbModule?.closeDb();
  loadedDbModule = null;

  await dropTestSchema();

  if (previousDatabaseUrl == null) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

async function loadModules(): Promise<{
  skills: SkillsModule;
  db: DbModule;
}> {
  await createTestSchema();

  const [skillsModule, db] = await Promise.all([
    import('./skills'),
    import('@/lib/db'),
  ]);
  loadedDbModule = db;

  await db.getDb().execute(sql`
    CREATE TABLE skills (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      display_name text NOT NULL,
      description text NOT NULL,
      content text NOT NULL,
      status text DEFAULT 'disabled' NOT NULL,
      source_session_id text,
      created_at timestamp with time zone NOT NULL,
      updated_at timestamp with time zone NOT NULL
    )
  `);
  await db.getDb().execute(sql`
    CREATE UNIQUE INDEX skills_name_unique ON skills USING btree (name)
  `);

  return { skills: skillsModule, db };
}

async function createTestSchema(): Promise<void> {
  if (testSchemaName == null) {
    return;
  }

  const admin = postgres(testDatabaseUrl, { max: 1 });

  try {
    await admin.unsafe(`CREATE SCHEMA IF NOT EXISTS ${testSchemaName}`);
  } finally {
    await admin.end();
  }
}

async function dropTestSchema(): Promise<void> {
  if (testSchemaName == null) {
    return;
  }

  const admin = postgres(testDatabaseUrl, { max: 1 });

  try {
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${testSchemaName} CASCADE`);
  } finally {
    await admin.end();
    testSchemaName = null;
  }
}

function withSearchPath(databaseUrl: string, schemaName: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set('options', `-c search_path=${schemaName}`);
  return url.toString();
}

describe('skill validation', () => {
  it('accepts safe slugs and rejects invalid names', async () => {
    const { skills } = await loadModules();

    expect(skills.validateSkillName('research-plan')).toEqual({
      ok: true,
      value: 'research-plan',
    });
    expect(skills.validateSkillName('Research Plan')).toEqual({
      ok: false,
      error: 'Skill name must use lowercase letters, numbers, and hyphens',
    });
    expect(skills.validateSkillName('bad_name')).toEqual({
      ok: false,
      error: 'Skill name must use lowercase letters, numbers, and hyphens',
    });
  });

  it('parses create input without enabling new skills', async () => {
    const { skills } = await loadModules();
    const parsed = skills.parseCreateSkillInput({
      name: 'summarize-notes',
      description: 'Summarize notes',
      content: 'Use concise bullets.',
    });

    expect(parsed).toEqual({
      ok: true,
      value: {
        name: 'summarize-notes',
        displayName: 'summarize-notes',
        description: 'Summarize notes',
        content: 'Use concise bullets.',
        sourceSessionId: undefined,
      },
    });
  });

  it('rejects blank display name updates', async () => {
    const { skills } = await loadModules();

    expect(skills.parseUpdateSkillInput({ displayName: '   ' })).toEqual({
      ok: false,
      error: 'Skill display name is required',
    });
  });
});

describe('skill persistence', () => {
  it('creates, lists, reads, updates, and toggles skills', async () => {
    const { skills } = await loadModules();

    const created = await skills.createSkill({
      name: 'research-plan',
      displayName: 'Research Plan',
      description: 'Plan research work',
      content: 'Ask clarifying questions first.',
    });

    expect(created).toMatchObject({
      id: 'skill-1',
      name: 'research-plan',
      status: 'disabled',
    });
    await expect(skills.listSkills()).resolves.toMatchObject([
      { id: 'skill-1', name: 'research-plan' },
    ]);
    await expect(skills.getSkillById('skill-1')).resolves.toMatchObject({
      displayName: 'Research Plan',
    });
    await expect(skills.getSkillByName('research-plan')).resolves.toMatchObject({
      id: 'skill-1',
    });

    await expect(
      skills.updateSkill('skill-1', {
        displayName: 'Updated Research Plan',
        content: 'Use the latest evidence.',
      }),
    ).resolves.toMatchObject({
      displayName: 'Updated Research Plan',
      content: 'Use the latest evidence.',
    });
    await expect(
      skills.setSkillStatus({ id: 'skill-1', status: 'enabled' }),
    ).resolves.toMatchObject({ status: 'enabled' });
  });

  it('returns a duplicate-name error on create or rename conflicts', async () => {
    const { skills } = await loadModules();

    await skills.createSkill({
      name: 'research-plan',
      description: 'Plan research work',
      content: 'First version',
    });
    await skills.createSkill({
      name: 'writing-guide',
      description: 'Guide writing work',
      content: 'Second version',
    });

    await expect(
      skills.createSkill({
        name: 'research-plan',
        description: 'Duplicate',
        content: 'Duplicate',
      }),
    ).rejects.toThrow(skills.DuplicateSkillNameError);
    await expect(
      skills.updateSkill('skill-2', { name: 'research-plan' }),
    ).rejects.toThrow(skills.DuplicateSkillNameError);
  });

  it('filters explicit calls and text search to enabled skills', async () => {
    const { skills } = await loadModules();

    await skills.createSkill({
      name: 'research-plan',
      displayName: 'Research Plan',
      description: 'Plan market research',
      content: 'Build a research outline.',
    });
    await skills.createSkill({
      name: 'disabled-plan',
      displayName: 'Disabled Plan',
      description: 'Plan that should not be used',
      content: 'Hidden plan content.',
    });
    await skills.setSkillStatus({ id: 'skill-1', status: 'enabled' });

    await expect(skills.getEnabledSkillByName('research-plan')).resolves.toMatchObject({
      id: 'skill-1',
    });
    await expect(skills.getEnabledSkillByName('disabled-plan')).resolves.toBeNull();
    await expect(skills.searchEnabledSkills({ query: 'plan' })).resolves.toEqual([
      expect.objectContaining({ id: 'skill-1', name: 'research-plan' }),
    ]);
  });
});
