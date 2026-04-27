import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonCreated, jsonError } from '@/lib/api/responses';
import {
  createSkillFromSession,
  SkillGenerationInputError,
} from '@/lib/skill-generation';
import { DuplicateSkillNameError } from '@/lib/skills';

type CreateSkillFromSessionRequest = {
  sessionId?: string;
  messageIds?: string[];
  name?: string;
  description?: string;
};

export async function POST(request: Request): Promise<Response> {
  const body = (await parseJsonBody(request)) as CreateSkillFromSessionRequest | null;

  if (body?.sessionId == null || !Array.isArray(body.messageIds)) {
    return jsonError('sessionId and messageIds are required', 400);
  }

  try {
    const skill = await createSkillFromSession({
      sessionId: body.sessionId,
      messageIds: body.messageIds,
      name: body.name,
      description: body.description,
    });

    return jsonCreated({ skill });
  } catch (error) {
    if (error instanceof SkillGenerationInputError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof DuplicateSkillNameError) {
      return jsonError('Skill name already exists', 409);
    }

    throw error;
  }
}
