import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonError } from '@/lib/api/responses';
import { isChatRequestBody } from '@/lib/chat/chat-request-validation';
import { streamChatSessionTurn } from '@/lib/chat/chat-stream-service';

type RouteContext = {
  params: Promise<{
    agentId: string;
    sessionId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const body = await parseJsonBody(request);
  const { agentId, sessionId } = await context.params;

  if (!isChatRequestBody(body)) {
    return jsonError('Invalid chat request', 400);
  }

  return streamChatSessionTurn({
    agentId,
    sessionId,
    requestSessionId: body.id,
    messages: body.messages,
    abortSignal: request.signal,
  });
}
