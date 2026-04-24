import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  formatJson,
  getPendingReplyLabel,
  getReasoningSummary,
  getStatusLabel,
  getToolDetailLines,
  getToolLiveLines,
  isToolActive,
  isToolFinished,
} from './helpers';

describe('chat helpers', () => {
  it('maps chat status labels', () => {
    expect(getStatusLabel('submitted')).toBe('请求已发送');
    expect(getStatusLabel('streaming')).toBe('正在回复');
    expect(getStatusLabel('error')).toBe('请求失败');
    expect(getStatusLabel('ready')).toBe('准备就绪');
  });

  it('maps pending reply labels', () => {
    expect(getPendingReplyLabel('submitted')).toBe('已收到，正在思考...');
    expect(getPendingReplyLabel('streaming')).toBe('正在生成回复...');
  });

  it('summarizes reasoning text', () => {
    expect(getReasoningSummary('   ')).toBe('思考中');
    expect(getReasoningSummary(' hello\nworld ')).toBe('hello world');
    expect(getReasoningSummary('a'.repeat(80))).toBe(`${'a'.repeat(72)}...`);
  });

  it('formats JSON defensively', () => {
    const circularValue: Record<string, unknown> = {};
    circularValue.self = circularValue;

    expect(formatJson(null)).toBe('');
    expect(formatJson({ ok: true })).toBe('{\n  "ok": true\n}');
    expect(formatJson(circularValue)).toBe('[object Object]');
  });

  it('detects active and finished tool states', () => {
    expect(isToolActive('input-streaming')).toBe(true);
    expect(isToolActive('output-available', true)).toBe(true);
    expect(isToolActive('output-available')).toBe(false);
    expect(isToolFinished('output-available')).toBe(true);
    expect(isToolFinished('output-available', true)).toBe(false);
    expect(isToolFinished('output-error')).toBe(true);
    expect(isToolFinished('input-available')).toBe(false);
  });

  it('formats durations using compact units', () => {
    expect(formatDuration(999)).toBe('999ms');
    expect(formatDuration(1200)).toBe('1.2s');
    expect(formatDuration(12_300)).toBe('12s');
  });

  it('limits live tool lines and keeps full detail lines', () => {
    const input = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`line-${index + 1}`, true]),
    );

    expect(
      getToolLiveLines({
        state: 'input-available',
        input,
      }),
    ).toEqual([
      'params    "line-4": true,',
      'params    "line-5": true,',
      'params    "line-6": true,',
      'params    "line-7": true,',
      'params    "line-8": true,',
      'params    "line-9": true,',
      'params    "line-10": true',
      'params  }',
    ]);
    expect(
      getToolDetailLines({
        state: 'output-error',
        input: { query: 'x' },
        errorText: 'failed',
      }),
    ).toEqual([
      'status  调用失败',
      'params  {',
      'params    "query": "x"',
      'params  }',
      'error   failed',
    ]);
  });
});
