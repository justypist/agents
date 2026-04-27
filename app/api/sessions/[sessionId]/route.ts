import {
  getChatSession,
  regenerateChatSessionTitle,
  setChatSessionArchived,
} from '@/lib/chat-session';
import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonError } from '@/lib/api/responses';

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

type UpdateSessionRequest = {
  archived?: boolean;
  regenerateTitle?: boolean;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { sessionId } = await context.params;
  const session = await getChatSession(sessionId);

  if (session == null) {
    return jsonError('Unknown sessionId', 404);
  }

  return Response.json({ session });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { sessionId } = await context.params;
  const body = (await parseJsonBody(request)) as UpdateSessionRequest | null;

  if (body?.regenerateTitle === true) {
    const title = await regenerateChatSessionTitle({ sessionId });

    if (title === undefined) {
      return jsonError('Unknown sessionId', 404);
    }

    if (title == null) {
      return jsonError('Failed to generate title', 400);
    }

    return Response.json({
      sessionId,
      title,
    });
  }

  if (typeof body?.archived !== 'boolean') {
    return jsonError('Invalid archived value', 400);
  }

  const updated = await setChatSessionArchived({
    sessionId,
    archived: body.archived,
  });

  if (!updated) {
    return jsonError('Unknown sessionId', 404);
  }

  return Response.json({
    sessionId,
    archived: body.archived,
  });
}
