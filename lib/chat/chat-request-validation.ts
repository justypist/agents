import type { UIMessage } from 'ai';

export type ChatRequestBody = {
  id?: string;
  messages: UIMessage[];
};

export function isChatRequestBody(value: unknown): value is ChatRequestBody {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.id == null || typeof value.id === 'string') &&
    Array.isArray(value.messages)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}
