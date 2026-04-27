import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonError } from '@/lib/api/responses';
import {
  completeChatSessionTurn,
  failChatSessionTurn,
  submitChatSessionTurn,
} from '@/lib/chat/chat-background-service';
import { isChatRequestBody } from '@/lib/chat/chat-request-validation';

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

  const result = await submitChatSessionTurn({
    agentId,
    sessionId,
    requestSessionId: body.id,
    messages: body.messages,
  });

  if (result.status === 'accepted') {
    void completeChatSessionTurn({
      agentId,
      sessionId,
      userMessageId: result.userMessage.id,
    }).catch(error => {
      void failChatSessionTurn({
        sessionId,
        userMessageId: result.userMessage.id,
        error,
      }).catch(() => undefined);
    });

    return Response.json({ session: result.session }, { status: 202 });
  }

  if (result.status === 'duplicate') {
    return Response.json({ session: result.session });
  }

  if (result.status === 'conflict') {
    return Response.json(
      { error: result.message, session: result.session },
      { status: 409 },
    );
  }

  return jsonError(result.message, result.status === 'not_found' ? 404 : 400);
}
