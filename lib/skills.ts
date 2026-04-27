import 'server-only';

import { generateId } from 'ai';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { skills, type SkillRow } from '@/lib/db/schema';

export type SkillStatus = 'enabled' | 'disabled';

export type Skill = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  content: string;
  status: SkillStatus;
  sourceSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SkillListItem = Skill;

export type CreateSkillInput = {
  name: string;
  displayName?: string;
  description: string;
  content: string;
  sourceSessionId?: string | null;
};

export type UpdateSkillInput = {
  name?: string;
  displayName?: string;
  description?: string;
  content?: string;
  status?: SkillStatus;
};

export type SkillSearchCandidate = Pick<
  Skill,
  'id' | 'name' | 'displayName' | 'description' | 'status' | 'updatedAt'
>;

export type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { ok: false; error: string };

export class DuplicateSkillNameError extends Error {
  constructor(name: string) {
    super(`Skill name already exists: ${name}`);
    this.name = 'DuplicateSkillNameError';
  }
}

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_CONTENT_LENGTH = 20000;
const DEFAULT_SKILL_LIMIT = 50;

export function validateSkillName(name: string): ValidationResult<string> {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return { ok: false, error: 'Skill name is required' };
  }

  if (trimmedName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: 'Skill name is too long' };
  }

  if (!SKILL_NAME_PATTERN.test(trimmedName)) {
    return {
      ok: false,
      error: 'Skill name must use lowercase letters, numbers, and hyphens',
    };
  }

  return { ok: true, value: trimmedName };
}

export function parseCreateSkillInput(
  value: unknown,
): ValidationResult<CreateSkillInput> {
  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid skill payload' };
  }

  const name = readString(value, 'name');
  const description = readString(value, 'description');
  const content = readString(value, 'content');
  const displayName = readOptionalString(value, 'displayName');
  const sourceSessionId = readNullableString(value, 'sourceSessionId');

  if (name == null || description == null || content == null) {
    return { ok: false, error: 'Missing required skill fields' };
  }

  const validName = validateSkillName(name);

  if (!validName.ok) {
    return validName;
  }

  if (!isValidTextLength(displayName ?? validName.value, MAX_DISPLAY_NAME_LENGTH)) {
    return { ok: false, error: 'Skill display name is too long' };
  }

  if (!isValidTextLength(description, MAX_DESCRIPTION_LENGTH)) {
    return { ok: false, error: 'Skill description is too long' };
  }

  if (!isValidTextLength(content, MAX_CONTENT_LENGTH)) {
    return { ok: false, error: 'Skill content is too long' };
  }

  if (description.trim().length === 0 || content.trim().length === 0) {
    return { ok: false, error: 'Skill description and content are required' };
  }

  return {
    ok: true,
    value: {
      name: validName.value,
      displayName: displayName?.trim() || validName.value,
      description: description.trim(),
      content: content.trim(),
      sourceSessionId,
    },
  };
}

export function parseUpdateSkillInput(
  value: unknown,
): ValidationResult<UpdateSkillInput> {
  if (!isRecord(value)) {
    return { ok: false, error: 'Invalid skill payload' };
  }

  const input: UpdateSkillInput = {};
  const name = readOptionalString(value, 'name');
  const displayName = readOptionalString(value, 'displayName');
  const description = readOptionalString(value, 'description');
  const content = readOptionalString(value, 'content');
  const status = readOptionalString(value, 'status');

  if (name != null) {
    const validName = validateSkillName(name);

    if (!validName.ok) {
      return validName;
    }

    input.name = validName.value;
  }

  if (displayName != null) {
    if (!isValidTextLength(displayName, MAX_DISPLAY_NAME_LENGTH)) {
      return { ok: false, error: 'Skill display name is too long' };
    }

    if (displayName.trim().length === 0) {
      return { ok: false, error: 'Skill display name is required' };
    }

    input.displayName = displayName.trim();
  }

  if (description != null) {
    if (!isValidTextLength(description, MAX_DESCRIPTION_LENGTH)) {
      return { ok: false, error: 'Skill description is too long' };
    }

    if (description.trim().length === 0) {
      return { ok: false, error: 'Skill description is required' };
    }

    input.description = description.trim();
  }

  if (content != null) {
    if (!isValidTextLength(content, MAX_CONTENT_LENGTH)) {
      return { ok: false, error: 'Skill content is too long' };
    }

    if (content.trim().length === 0) {
      return { ok: false, error: 'Skill content is required' };
    }

    input.content = content.trim();
  }

  if (status != null) {
    const parsedStatus = parseSkillStatus(status);

    if (parsedStatus == null) {
      return { ok: false, error: 'Invalid skill status' };
    }

    input.status = parsedStatus;
  }

  if (Object.keys(input).length === 0) {
    return { ok: false, error: 'No skill fields to update' };
  }

  return { ok: true, value: input };
}

export function parseSkillStatus(value: string): SkillStatus | null {
  if (value === 'enabled' || value === 'disabled') {
    return value;
  }

  return null;
}

export async function listSkills(input?: {
  status?: SkillStatus;
  limit?: number;
}): Promise<SkillListItem[]> {
  const limit = normalizeLimit(input?.limit);
  const rows = await getDb()
    .select()
    .from(skills)
    .where(input?.status == null ? undefined : eq(skills.status, input.status))
    .orderBy(desc(skills.updatedAt), desc(skills.id))
    .limit(limit);

  return rows.map(mapSkillRow);
}

export async function getSkillById(id: string): Promise<Skill | null> {
  const row = await getDb().query.skills.findFirst({
    where: eq(skills.id, id),
  });

  return row == null ? null : mapSkillRow(row);
}

export async function getSkillByName(name: string): Promise<Skill | null> {
  const row = await getDb().query.skills.findFirst({
    where: eq(skills.name, name),
  });

  return row == null ? null : mapSkillRow(row);
}

export async function createSkill(input: CreateSkillInput): Promise<Skill> {
  const now = new Date();
  const values = {
    id: generateId(),
    name: input.name,
    displayName: input.displayName?.trim() || input.name,
    description: input.description,
    content: input.content,
    status: 'disabled',
    sourceSessionId: input.sourceSessionId ?? null,
    createdAt: now,
    updatedAt: now,
  } satisfies typeof skills.$inferInsert;

  try {
    const [row] = await getDb().insert(skills).values(values).returning();
    return mapSkillRow(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateSkillNameError(input.name);
    }

    throw error;
  }
}

export async function updateSkill(
  id: string,
  input: UpdateSkillInput,
): Promise<Skill | null> {
  const values = {
    ...input,
    updatedAt: new Date(),
  } satisfies Partial<typeof skills.$inferInsert>;

  try {
    const [row] = await getDb()
      .update(skills)
      .set(values)
      .where(eq(skills.id, id))
      .returning();

    return row == null ? null : mapSkillRow(row);
  } catch (error) {
    if (input.name != null && isUniqueViolation(error)) {
      throw new DuplicateSkillNameError(input.name);
    }

    throw error;
  }
}

export async function setSkillStatus(input: {
  id: string;
  status: SkillStatus;
}): Promise<Skill | null> {
  return updateSkill(input.id, { status: input.status });
}

export async function getEnabledSkillByName(name: string): Promise<Skill | null> {
  const row = await getDb().query.skills.findFirst({
    where: and(eq(skills.name, name), eq(skills.status, 'enabled')),
  });

  return row == null ? null : mapSkillRow(row);
}

export async function getEnabledSkillById(id: string): Promise<Skill | null> {
  const row = await getDb().query.skills.findFirst({
    where: and(eq(skills.id, id), eq(skills.status, 'enabled')),
  });

  return row == null ? null : mapSkillRow(row);
}

export async function searchEnabledSkills(input: {
  query: string;
  limit?: number;
}): Promise<SkillSearchCandidate[]> {
  const query = input.query.trim();

  if (query.length === 0) {
    return [];
  }

  const pattern = `%${escapeLikePattern(query)}%`;
  const rows = await getDb()
    .select({
      id: skills.id,
      name: skills.name,
      displayName: skills.displayName,
      description: skills.description,
      content: skills.content,
      status: skills.status,
      sourceSessionId: skills.sourceSessionId,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
    })
    .from(skills)
    .where(
      and(
        eq(skills.status, 'enabled'),
        or(
          ilike(skills.name, pattern),
          ilike(skills.displayName, pattern),
          ilike(skills.description, pattern),
          ilike(skills.content, pattern),
        ),
      ),
    )
    .orderBy(desc(skills.updatedAt), desc(skills.id))
    .limit(normalizeLimit(input.limit));

  return rows.map(row => {
    const skill = mapSkillRow(row);

    return {
      id: skill.id,
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      status: skill.status,
      updatedAt: skill.updatedAt,
    };
  });
}

function mapSkillRow(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    content: row.content,
    status: parseSkillStatus(row.status) ?? 'disabled',
    sourceSessionId: row.sourceSessionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function readString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const field = value[key];
  return typeof field === 'string' ? field : null;
}

function readOptionalString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
}

function readNullableString(
  value: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const field = value[key];

  if (field == null) {
    return field;
  }

  return typeof field === 'string' ? field : undefined;
}

function isValidTextLength(value: string, maxLength: number): boolean {
  return value.trim().length <= maxLength;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) {
    return DEFAULT_SKILL_LIMIT;
  }

  return Math.min(Math.max(1, Math.floor(limit)), 100);
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error == null) {
    return false;
  }

  if ('code' in error && (error as { code?: unknown }).code === '23505') {
    return true;
  }

  if ('cause' in error) {
    return isUniqueViolation((error as { cause?: unknown }).cause);
  }

  return false;
}
