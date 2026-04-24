import { isToolUIPart, type UIMessage } from 'ai';

export function normalizeInterruptedMessages(
  messages: UIMessage[],
  toolErrorText: string,
): UIMessage[] {
  let changed = false;
  const nextMessages = [...messages];

  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    const message = nextMessages[index];

    if (message.role !== 'assistant') {
      continue;
    }

    const normalizedParts: typeof message.parts = message.parts.map(part => {
      if (part.type === 'reasoning') {
        if (part.state !== 'streaming') {
          return part;
        }

        changed = true;
        return {
          ...part,
          state: 'done' as const,
        };
      }

      if (part.type === 'text') {
        if (part.state !== 'streaming') {
          return part;
        }

        changed = true;
        return {
          ...part,
          state: 'done' as const,
        };
      }

      if (!isToolUIPart(part)) {
        return part;
      }

      if (
        part.state === 'input-streaming' ||
        part.state === 'input-available' ||
        part.state === 'approval-requested' ||
        part.state === 'approval-responded'
      ) {
        changed = true;
        const { approval: _approval, output: _output, ...restPart } = part;
        void _approval;
        void _output;

        return {
          ...restPart,
          state: 'output-error' as const,
          errorText: toolErrorText,
        };
      }

      return part;
    });

    if (!changed) {
      return messages;
    }

    nextMessages[index] = {
      ...message,
      parts: normalizedParts,
    };

    return nextMessages;
  }

  return messages;
}
