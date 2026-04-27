import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonError } from '@/lib/api/responses';
import {
  adjustSkillFromSession,
  SkillGenerationInputError,
} from '@/lib/skill-generation';

type RouteContext = {
  params: Promise<{
    skillId: string;
  }>;
};

type AdjustSkillFromSessionRequest = {
  sessionId?: string;
  messageIds?: string[];
  prompt?: string;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { skillId } = await context.params;
  const body = (await parseJsonBody(request)) as AdjustSkillFromSessionRequest | null;

  if (body?.sessionId == null || !Array.isArray(body.messageIds)) {
    return jsonError('sessionId and messageIds are required', 400);
  }

  try {
    const skill = await adjustSkillFromSession({
      skillId,
      sessionId: body.sessionId,
      messageIds: body.messageIds,
      prompt: body.prompt,
    });

    return Response.json({ skill });
  } catch (error) {
    if (error instanceof SkillGenerationInputError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }
}
