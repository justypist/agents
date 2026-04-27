import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';

import type { ModelMessage } from 'ai';

export type ProjectSkill = {
  name: string;
  description: string;
  content: string;
  filePath: string;
};

export type SkillLoadError = {
  filePath: string;
  message: string;
};

export type ProjectSkillsResult = {
  skills: ProjectSkill[];
  errors: SkillLoadError[];
};

const SKILLS_DIR = path.join('.agents', 'skills');
const SKILL_FILE_NAME = 'SKILL.md';
const STOP_WORDS = new Set([
  'about',
  'agent',
  'agents',
  'and',
  'ask',
  'build',
  'developers',
  'for',
  'from',
  'have',
  'how',
  'into',
  'like',
  'project',
  'questions',
  'systems',
  'that',
  'the',
  'their',
  'this',
  'tool',
  'tools',
  'use',
  'using',
  'want',
  'when',
  'with',
]);

export async function discoverProjectSkills(
  rootDir = process.cwd(),
): Promise<ProjectSkillsResult> {
  const skillsDir = path.join(rootDir, SKILLS_DIR);

  let entries: Dirent<string>[];

  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { skills: [], errors: [] };
    }

    return {
      skills: [],
      errors: [
        {
          filePath: skillsDir,
          message: error instanceof Error ? error.message : 'Failed to read skills directory.',
        },
      ],
    };
  }

  const result: ProjectSkillsResult = { skills: [], errors: [] };

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const filePath = path.join(skillsDir, entry.name, SKILL_FILE_NAME);

    try {
      result.skills.push(await loadSkillFile(filePath));
    } catch (error) {
      result.errors.push({
        filePath,
        message: error instanceof Error ? error.message : 'Failed to load skill.',
      });
    }
  }

  result.skills.sort((left, right) => left.name.localeCompare(right.name));
  result.errors.sort((left, right) => left.filePath.localeCompare(right.filePath));

  return result;
}

export async function loadProjectSkill(
  name: string,
  rootDir = process.cwd(),
): Promise<ProjectSkill | null> {
  const { skills } = await discoverProjectSkills(rootDir);
  return skills.find(skill => skill.name === name) ?? null;
}

export function selectSkillsForMessages(
  skills: ProjectSkill[],
  messages: ModelMessage[],
): ProjectSkill[] {
  const requestText = extractMessageText(messages).toLowerCase();

  if (requestText.length === 0) {
    return [];
  }

  return skills
    .map(skill => ({ skill, score: scoreSkillMatch(skill, requestText) }))
    .filter(match => match.score > 0)
    .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name))
    .map(match => match.skill);
}

export function injectSkillsIntoMessages(
  messages: ModelMessage[],
  skills: ProjectSkill[],
): ModelMessage[] {
  if (skills.length === 0) {
    return messages;
  }

  return [
    {
      role: 'system',
      content: formatSkillsForContext(skills),
    },
    ...messages,
  ];
}

export function formatSkillsForContext(skills: ProjectSkill[]): string {
  return [
    'The following project skills were selected for this request. Follow their instructions when relevant.',
    ...skills.map(skill => [
      `<skill name="${skill.name}">`,
      `<description>${skill.description}</description>`,
      skill.content.trim(),
      '</skill>',
    ].join('\n')),
  ].join('\n\n');
}

async function loadSkillFile(filePath: string): Promise<ProjectSkill> {
  let raw: string;

  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error('Skill file is missing.');
    }

    throw error;
  }

  return parseSkillFile(raw, filePath);
}

function parseSkillFile(raw: string, filePath: string): ProjectSkill {
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (frontmatterMatch == null) {
    throw new Error('Skill file must start with YAML frontmatter.');
  }

  const metadata = parseFrontmatter(frontmatterMatch[1]);
  const name = metadata.get('name')?.trim();
  const description = metadata.get('description')?.trim();
  const content = raw.slice(frontmatterMatch[0].length).trim();

  if (name == null || name.length === 0) {
    throw new Error('Skill is missing required frontmatter field "name".');
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error('Skill name must use lowercase letters, numbers, and hyphens.');
  }

  if (description == null || description.length === 0) {
    throw new Error('Skill is missing required frontmatter field "description".');
  }

  if (content.length === 0) {
    throw new Error('Skill must include instruction content.');
  }

  return { name, description, content, filePath };
}

function parseFrontmatter(frontmatter: string): Map<string, string> {
  const metadata = new Map<string, string>();

  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);

    if (match == null) {
      continue;
    }

    metadata.set(match[1], unquoteYamlScalar(match[2].trim()));
  }

  return metadata;
}

function unquoteYamlScalar(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function scoreSkillMatch(skill: ProjectSkill, requestText: string): number {
  let score = 0;

  if (requestText.includes(skill.name.toLowerCase())) {
    score += 10;
  }

  for (const phrase of extractQuotedPhrases(skill.description)) {
    if (requestText.includes(phrase.toLowerCase())) {
      score += 8;
    }
  }

  for (const token of extractMatchTokens(`${skill.name} ${skill.description}`)) {
    if (requestText.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function extractQuotedPhrases(text: string): string[] {
  return Array.from(text.matchAll(/["“”]([^"“”]{3,})["“”]/g), match => match[1]);
}

function extractMatchTokens(text: string): string[] {
  return Array.from(new Set(text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []))
    .filter(token => !STOP_WORDS.has(token));
}

function extractMessageText(messages: ModelMessage[]): string {
  return messages.map(message => extractContentText(message.content)).join('\n');
}

function extractContentText(content: ModelMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map(part => {
      if (part.type === 'text') {
        return part.text;
      }

      return '';
    })
    .join('\n');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error != null && 'code' in error;
}
