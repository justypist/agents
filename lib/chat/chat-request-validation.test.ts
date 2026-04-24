/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { isChatRequestBody } from './chat-request-validation';

describe('isChatRequestBody', () => {
  it('accepts a message array with an optional string id', () => {
    expect(isChatRequestBody({ messages: [] })).toBe(true);
    expect(isChatRequestBody({ id: 'session-1', messages: [] })).toBe(true);
  });

  it('rejects non-object values', () => {
    expect(isChatRequestBody(null)).toBe(false);
    expect(isChatRequestBody('value')).toBe(false);
    expect(isChatRequestBody(1)).toBe(false);
  });

  it('rejects invalid id and messages fields', () => {
    expect(isChatRequestBody({ id: 1, messages: [] })).toBe(false);
    expect(isChatRequestBody({ id: 'session-1', messages: {} })).toBe(false);
    expect(isChatRequestBody({ id: 'session-1' })).toBe(false);
  });
});
