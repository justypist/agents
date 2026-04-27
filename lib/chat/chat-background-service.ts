import 'server-only';

import { validateUIMessages, type UIMessage } from 'ai';

import { resolveRequestedAgent } from '@/lib/agent-registry';
import {
  getChatSession,
  saveChatSessionMessages,
  type StoredChatSession,
} from '@/lib/chat-session';

export type SubmitChatSessionTurnResult =
  | {
      status: 'accepted';
      session: StoredChatSession;
      userMessage: UIMessage;
    }
  | {
      status: 'duplicate';
      session: StoredChatSession;
    }
  | {
      status: 'conflict';
      message: string;
      session: StoredChatSession;
    }
  | {
      status: 'not_found';
      message: string;
    }
  | {
      status: 'invalid';
      message: string;
    };

export async function submitChatSessionTurn(input: {
  agentId: string;
  sessionId: string;
  requestSessionId?: string;
  messages: UIMessage[];
}): Promise<SubmitChatSessionTurnResult> {
  const resolvedAgent = await resolveRequestedAgent(input.agentId);

  if (resolvedAgent == null) {
    return { status: 'invalid', message: 'Unknown agentId' };
  }

  if (input.requestSessionId != null && input.requestSessionId !== input.sessionId) {
    return { status: 'invalid', message: 'Mismatched sessionId' };
  }

  const session = await getChatSession(input.sessionId);

  if (session == null) {
    return { status: 'not_found', message: 'Unknown sessionId' };
  }

  if (session.agentId !== resolvedAgent.id) {
    return { status: 'invalid', message: 'Session does not belong to agentId' };
  }

  const validatedMessages = await validateUIMessages({
    messages: input.messages,
  });
  const userMessage = findLastUserMessage(validatedMessages);

  if (userMessage == null) {
    return { status: 'invalid', message: 'Missing user message' };
  }

  if (session.turnState.currentUserMessageId === userMessage.id) {
    return { status: 'duplicate', session };
  }

  if (session.turnState.status === 'running') {
    return {
      status: 'conflict',
      message: 'A chat turn is already running. Please wait for it to finish.',
      session,
    };
  }

  const existingMessage = session.messages.find(message => message.id === userMessage.id);

  if (existingMessage != null) {
    return { status: 'duplicate', session };
  }

  const nextMessages = [...session.messages, userMessage];

  await saveChatSessionMessages({
    sessionId: session.id,
    messages: nextMessages,
    turnState: {
      status: 'running',
      currentUserMessageId: userMessage.id,
      errorSummary: null,
    },
  });

  const nextSession = await getChatSession(session.id);

  if (nextSession == null) {
    return { status: 'not_found', message: 'Unknown sessionId' };
  }

  return {
    status: 'accepted',
    session: nextSession,
    userMessage,
  };
}

function findLastUserMessage(messages: UIMessage[]): UIMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === 'user') {
      return message;
    }
  }

  return null;
}
