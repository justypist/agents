import 'server-only';

import { validateUIMessages, type UIMessage } from 'ai';

import { resolveRequestedAgent } from '@/lib/agent-registry';
import {
  getChatSession,
  saveChatSessionMessages,
  updateChatSessionTurnState,
  type StoredChatSession,
} from '@/lib/chat-session';
import { generateAgentReplyMessages } from '@/lib/chat/chat-stream-service';

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

export async function completeChatSessionTurn(input: {
  agentId: string;
  sessionId: string;
  userMessageId: string;
}): Promise<StoredChatSession> {
  const resolvedAgent = await resolveRequestedAgent(input.agentId);

  if (resolvedAgent == null) {
    throw new Error('Unknown agentId');
  }

  const session = await getChatSession(input.sessionId);

  if (session == null) {
    throw new Error('Unknown sessionId');
  }

  if (session.agentId !== resolvedAgent.id) {
    throw new Error('Session does not belong to agentId');
  }

  if (
    session.turnState.status !== 'running' ||
    session.turnState.currentUserMessageId !== input.userMessageId
  ) {
    throw new Error('Chat turn is no longer running');
  }

  const messages = await generateAgentReplyMessages({
    agent: resolvedAgent.agent,
    messages: session.messages,
  });

  await saveChatSessionMessages({
    sessionId: session.id,
    messages,
    turnState: {
      status: 'completed',
      currentUserMessageId: input.userMessageId,
      errorSummary: null,
    },
  });

  const nextSession = await getChatSession(session.id);

  if (nextSession == null) {
    throw new Error('Unknown sessionId');
  }

  return nextSession;
}

export async function failChatSessionTurn(input: {
  sessionId: string;
  userMessageId: string;
  error: unknown;
}): Promise<StoredChatSession> {
  const session = await getChatSession(input.sessionId);

  if (session == null) {
    throw new Error('Unknown sessionId');
  }

  if (session.turnState.currentUserMessageId !== input.userMessageId) {
    throw new Error('Chat turn no longer matches failed user message');
  }

  await updateChatSessionTurnState({
    sessionId: session.id,
    turnState: {
      status: 'failed',
      currentUserMessageId: input.userMessageId,
      errorSummary: summarizeError(input.error),
    },
  });

  const nextSession = await getChatSession(session.id);

  if (nextSession == null) {
    throw new Error('Unknown sessionId');
  }

  return nextSession;
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

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return truncateErrorSummary(error.message.trim());
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return truncateErrorSummary(error.trim());
  }

  return 'Agent reply failed. Please try again later.';
}

function truncateErrorSummary(value: string): string {
  return value.length > 240 ? `${value.slice(0, 239).trimEnd()}…` : value;
}
