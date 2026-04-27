import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonError } from '@/lib/api/responses';
import {
  rewriteSkillSelection,
  SkillGenerationInputError,
} from '@/lib/skill-generation';

type RewriteSelectionRequest = {
  content?: string;
  selection?: string;
  prompt?: string;
};

export async function POST(request: Request): Promise<Response> {
  const body = (await parseJsonBody(request)) as RewriteSelectionRequest | null;

  if (
    typeof body?.content !== 'string' ||
    typeof body.selection !== 'string' ||
    typeof body.prompt !== 'string'
  ) {
    return jsonError('content, selection, and prompt are required', 400);
  }

  try {
    const candidate = await rewriteSkillSelection({
      content: body.content,
      selection: body.selection,
      prompt: body.prompt,
    });

    return Response.json({ candidate });
  } catch (error) {
    if (error instanceof SkillGenerationInputError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }
}
