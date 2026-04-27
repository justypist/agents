import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonCreated, jsonError } from '@/lib/api/responses';
import {
  createSkill,
  DuplicateSkillNameError,
  listSkills,
  parseCreateSkillInput,
  parseSkillStatus,
  type SkillStatus,
} from '@/lib/skills';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  let status: SkillStatus | undefined;

  if (statusParam != null) {
    const parsedStatus = parseSkillStatus(statusParam);

    if (parsedStatus == null) {
      return jsonError('Invalid skill status', 400);
    }

    status = parsedStatus;
  }

  const skills = await listSkills({ status });
  return Response.json({ skills });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = parseCreateSkillInput(await parseJsonBody(request));

  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  try {
    const skill = await createSkill(parsed.value);
    return jsonCreated({ skill });
  } catch (error) {
    if (error instanceof DuplicateSkillNameError) {
      return jsonError('Skill name already exists', 409);
    }

    throw error;
  }
}
