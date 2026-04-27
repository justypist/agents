import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonError } from '@/lib/api/responses';
import {
  DuplicateSkillNameError,
  getSkillById,
  parseUpdateSkillInput,
  updateSkill,
} from '@/lib/skills';

type RouteContext = {
  params: Promise<{
    skillId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { skillId } = await context.params;
  const skill = await getSkillById(skillId);

  if (skill == null) {
    return jsonError('Unknown skillId', 404);
  }

  return Response.json({ skill });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { skillId } = await context.params;
  const parsed = parseUpdateSkillInput(await parseJsonBody(request));

  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  try {
    const skill = await updateSkill(skillId, parsed.value);

    if (skill == null) {
      return jsonError('Unknown skillId', 404);
    }

    return Response.json({ skill });
  } catch (error) {
    if (error instanceof DuplicateSkillNameError) {
      return jsonError('Skill name already exists', 409);
    }

    throw error;
  }
}
