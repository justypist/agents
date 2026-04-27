/** @vitest-environment node */

import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ModelMessage } from 'ai';
import { describe, expect, it } from 'vitest';

import {
  discoverProjectSkills,
  injectSkillsIntoMessages,
  loadProjectSkill,
  selectSkillsForMessages,
} from './skills';

describe('project skills', () => {
  it('discovers valid project skills from the conventional directory', async () => {
    const rootDir = await createTempProject();
    await writeSkill(rootDir, 'ai-sdk', {
      frontmatter: [
        'name: ai-sdk',
        'description: "Use for AI SDK questions and generateText."',
      ],
      content: 'Always check local AI SDK docs before answering.',
    });

    const result = await discoverProjectSkills(rootDir);

    expect(result.errors).toEqual([]);
    expect(result.skills).toEqual([
      expect.objectContaining({
        name: 'ai-sdk',
        description: 'Use for AI SDK questions and generateText.',
        content: 'Always check local AI SDK docs before answering.',
      }),
    ]);
  });

  it('reports malformed or missing skill files without failing discovery', async () => {
    const rootDir = await createTempProject();
    await mkdir(path.join(rootDir, '.agents', 'skills', 'missing'), {
      recursive: true,
    });
    await writeSkill(rootDir, 'bad', {
      frontmatter: ['name: bad'],
      content: 'Missing description should be rejected.',
    });
    await writeSkill(rootDir, 'valid', {
      frontmatter: ['name: valid', 'description: Valid skill.'],
      content: 'Valid instructions.',
    });

    const result = await discoverProjectSkills(rootDir);

    expect(result.skills.map(skill => skill.name)).toEqual(['valid']);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map(error => error.message)).toEqual([
      'Skill is missing required frontmatter field "description".',
      'Skill file is missing.',
    ]);
  });

  it('loads a skill by name', async () => {
    const rootDir = await createTempProject();
    await writeSkill(rootDir, 'research', {
      frontmatter: ['name: research', 'description: Research workflow.'],
      content: 'Use primary sources.',
    });

    await expect(loadProjectSkill('research', rootDir)).resolves.toEqual(
      expect.objectContaining({ name: 'research' }),
    );
    await expect(loadProjectSkill('missing', rootDir)).resolves.toBeNull();
  });

  it('selects and injects matching skill instructions into model context', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Please use generateText from the AI SDK.' }],
      },
    ];
    const selectedSkills = selectSkillsForMessages(
      [
        {
          name: 'ai-sdk',
          description: 'Use for "AI SDK" and "generateText" questions.',
          content: 'Check current docs.',
          filePath: '/project/.agents/skills/ai-sdk/SKILL.md',
        },
        {
          name: 'pubmed',
          description: 'Use for biomedical literature searches.',
          content: 'Search PubMed.',
          filePath: '/project/.agents/skills/pubmed/SKILL.md',
        },
      ],
      messages,
    );

    expect(selectedSkills.map(skill => skill.name)).toEqual(['ai-sdk']);
    expect(injectSkillsIntoMessages(messages, selectedSkills)).toEqual([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('<skill name="ai-sdk">'),
      }),
      ...messages,
    ]);
  });
});

async function createTempProject(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'agents-skills-'));
}

async function writeSkill(
  rootDir: string,
  skillDir: string,
  input: { frontmatter: string[]; content: string },
): Promise<void> {
  const directory = path.join(rootDir, '.agents', 'skills', skillDir);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'SKILL.md'),
    ['---', ...input.frontmatter, '---', '', input.content].join('\n'),
    'utf8',
  );
}
