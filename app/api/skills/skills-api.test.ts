/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as adjustRoute from './[skillId]/adjust-from-session/route';
import * as skillRoute from './[skillId]/route';
import * as createFromSessionRoute from './from-session/route';
import * as rewriteSelectionRoute from './rewrite-selection/route';
import * as skillsRoute from './route';
import {
  DuplicateSkillNameError,
  createSkill,
  getSkillById,
  listSkills,
  parseCreateSkillInput,
  parseSkillStatus,
  parseUpdateSkillInput,
  updateSkill,
} from '@/lib/skills';
import {
  SkillGenerationInputError,
  adjustSkillFromSession,
  createSkillFromSession,
  rewriteSkillSelection,
} from '@/lib/skill-generation';

vi.mock('@/lib/skills', () => {
  class MockDuplicateSkillNameError extends Error {}

  return {
    DuplicateSkillNameError: MockDuplicateSkillNameError,
    createSkill: vi.fn(),
    getSkillById: vi.fn(),
    listSkills: vi.fn(),
    parseCreateSkillInput: vi.fn(),
    parseSkillStatus: vi.fn((value: string) =>
      value === 'enabled' || value === 'disabled' ? value : null,
    ),
    parseUpdateSkillInput: vi.fn(),
    updateSkill: vi.fn(),
  };
});

vi.mock('@/lib/skill-generation', () => {
  class MockSkillGenerationInputError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }

  return {
    SkillGenerationInputError: MockSkillGenerationInputError,
    adjustSkillFromSession: vi.fn(),
    createSkillFromSession: vi.fn(),
    rewriteSkillSelection: vi.fn(),
  };
});

const skill = {
  id: 'skill-1',
  name: 'research-plan',
  displayName: 'Research Plan',
  description: 'Plan research',
  content: 'Use structured steps.',
  status: 'disabled' as const,
  sourceSessionId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('skills API routes', () => {
  beforeEach(() => {
    vi.mocked(createSkill).mockResolvedValue(skill);
    vi.mocked(getSkillById).mockResolvedValue(skill);
    vi.mocked(listSkills).mockResolvedValue([skill]);
    vi.mocked(parseCreateSkillInput).mockReturnValue({
      ok: true,
      value: {
        name: 'research-plan',
        description: 'Plan research',
        content: 'Use structured steps.',
      },
    });
    vi.mocked(parseUpdateSkillInput).mockReturnValue({
      ok: true,
      value: { status: 'enabled' },
    });
    vi.mocked(updateSkill).mockResolvedValue({ ...skill, status: 'enabled' });
    vi.mocked(createSkillFromSession).mockResolvedValue(skill);
    vi.mocked(adjustSkillFromSession).mockResolvedValue({
      ...skill,
      content: 'Updated content.',
    });
    vi.mocked(rewriteSkillSelection).mockResolvedValue('Better candidate');
  });

  it('lists and creates skills', async () => {
    const listResponse = await skillsRoute.GET(
      new Request('http://localhost/api/skills?status=enabled'),
    );
    const createResponse = await skillsRoute.POST(
      jsonRequest('http://localhost/api/skills', {
        name: 'research-plan',
        description: 'Plan research',
        content: 'Use structured steps.',
      }),
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      skills: [{ id: 'skill-1' }],
    });
    expect(parseSkillStatus).toHaveBeenCalledWith('enabled');
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      skill: { id: 'skill-1' },
    });
  });

  it('rejects invalid create payloads and duplicate names', async () => {
    vi.mocked(parseCreateSkillInput).mockReturnValueOnce({
      ok: false,
      error: 'Invalid skill payload',
    });

    const invalidResponse = await skillsRoute.POST(
      jsonRequest('http://localhost/api/skills', {}),
    );

    vi.mocked(createSkill).mockRejectedValueOnce(
      new DuplicateSkillNameError('research-plan'),
    );
    const duplicateResponse = await skillsRoute.POST(
      jsonRequest('http://localhost/api/skills', {
        name: 'research-plan',
        description: 'Plan research',
        content: 'Use structured steps.',
      }),
    );

    expect(invalidResponse.status).toBe(400);
    expect(duplicateResponse.status).toBe(409);
  });

  it('reads, updates, and reports unknown skills', async () => {
    const context = { params: Promise.resolve({ skillId: 'skill-1' }) };
    const getResponse = await skillRoute.GET(new Request('http://localhost'), context);
    const updateResponse = await skillRoute.PATCH(
      jsonRequest('http://localhost', { status: 'enabled' }),
      context,
    );

    vi.mocked(getSkillById).mockResolvedValueOnce(null);
    const missingResponse = await skillRoute.GET(
      new Request('http://localhost'),
      context,
    );

    expect(getResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(missingResponse.status).toBe(404);
  });

  it('creates a skill from selected chat messages', async () => {
    const response = await createFromSessionRoute.POST(
      jsonRequest('http://localhost', {
        sessionId: 'session-1',
        messageIds: ['message-1'],
      }),
    );

    expect(response.status).toBe(201);
    expect(createSkillFromSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      messageIds: ['message-1'],
      name: undefined,
      description: undefined,
    });
  });

  it('reports chat selection and session errors', async () => {
    const invalidResponse = await createFromSessionRoute.POST(
      jsonRequest('http://localhost', { sessionId: 'session-1' }),
    );

    vi.mocked(createSkillFromSession).mockRejectedValueOnce(
      new SkillGenerationInputError('Selected message does not belong to session', 400),
    );
    const mismatchResponse = await createFromSessionRoute.POST(
      jsonRequest('http://localhost', {
        sessionId: 'session-1',
        messageIds: ['other-message'],
      }),
    );

    vi.mocked(createSkillFromSession).mockRejectedValueOnce(
      new SkillGenerationInputError('Unknown sessionId', 404),
    );
    const missingSessionResponse = await createFromSessionRoute.POST(
      jsonRequest('http://localhost', {
        sessionId: 'missing',
        messageIds: ['message-1'],
      }),
    );

    expect(invalidResponse.status).toBe(400);
    expect(mismatchResponse.status).toBe(400);
    expect(missingSessionResponse.status).toBe(404);
  });

  it('adjusts existing skills and rewrites editor selections', async () => {
    const context = { params: Promise.resolve({ skillId: 'skill-1' }) };
    const adjustResponse = await adjustRoute.POST(
      jsonRequest('http://localhost', {
        sessionId: 'session-1',
        messageIds: ['message-1'],
        prompt: 'Merge lessons',
      }),
      context,
    );
    const rewriteResponse = await rewriteSelectionRoute.POST(
      jsonRequest('http://localhost', {
        content: 'Full content',
        selection: 'content',
        prompt: 'Make concise',
      }),
    );

    vi.mocked(adjustSkillFromSession).mockRejectedValueOnce(
      new SkillGenerationInputError('Unknown skillId', 404),
    );
    const missingSkillResponse = await adjustRoute.POST(
      jsonRequest('http://localhost', {
        sessionId: 'session-1',
        messageIds: ['message-1'],
      }),
      context,
    );

    expect(adjustResponse.status).toBe(200);
    expect(rewriteResponse.status).toBe(200);
    await expect(rewriteResponse.json()).resolves.toEqual({
      candidate: 'Better candidate',
    });
    expect(missingSkillResponse.status).toBe(404);
  });
});

function jsonRequest(url: string, body: object): Request {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}
