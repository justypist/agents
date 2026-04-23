import { setChatSessionArchived } from '@/lib/chat-session';

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

type UpdateSessionRequest = {
  archived?: boolean;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { sessionId } = await context.params;
  const body = (await parseJson(request)) as UpdateSessionRequest | null;

  if (typeof body?.archived !== 'boolean') {
    return Response.json({ error: 'Invalid archived value' }, { status: 400 });
  }

  const updated = await setChatSessionArchived({
    sessionId,
    archived: body.archived,
  });

  if (!updated) {
    return Response.json({ error: 'Unknown sessionId' }, { status: 404 });
  }

  return Response.json({
    sessionId,
    archived: body.archived,
  });
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}
