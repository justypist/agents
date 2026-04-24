import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';

import { normalizeInterruptedMessages } from './normalize-interrupted-messages';

describe('normalizeInterruptedMessages', () => {
  it('normalizes the latest assistant streaming text, reasoning, and pending tools', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          { type: 'reasoning', text: 'thinking', state: 'streaming' },
          { type: 'text', text: 'partial', state: 'streaming' },
          {
            type: 'dynamic-tool',
            toolName: 'search',
            toolCallId: 'tool-1',
            state: 'input-available',
            input: { query: 'x' },
          },
        ],
      },
    ];

    const normalized = normalizeInterruptedMessages(messages, '已停止');

    expect(normalized).not.toBe(messages);
    expect(normalized[1]?.parts).toEqual([
      { type: 'reasoning', text: 'thinking', state: 'done' },
      { type: 'text', text: 'partial', state: 'done' },
      {
        type: 'dynamic-tool',
        toolName: 'search',
        toolCallId: 'tool-1',
        state: 'output-error',
        input: { query: 'x' },
        errorText: '已停止',
      },
    ]);
  });

  it('only normalizes the latest assistant message', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'old', state: 'streaming' }],
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'new', state: 'streaming' }],
      },
    ];

    const normalized = normalizeInterruptedMessages(messages, '中断');

    expect(normalized[0]).toBe(messages[0]);
    expect(normalized[1]?.parts[0]).toEqual({
      type: 'text',
      text: 'new',
      state: 'done',
    });
  });

  it('returns the original array when there is nothing to normalize', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'done', state: 'done' },
          {
            type: 'dynamic-tool',
            toolName: 'search',
            toolCallId: 'tool-1',
            state: 'output-available',
            input: { query: 'x' },
            output: { ok: true },
          },
        ],
      },
    ];

    expect(normalizeInterruptedMessages(messages, '中断')).toBe(messages);
  });
});
