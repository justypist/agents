/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { parseSkillInvocationPrefix } from './skill-invocation';

describe('parseSkillInvocationPrefix', () => {
  it('parses a leading skill slug and preserves remaining task text', () => {
    expect(parseSkillInvocationPrefix('/research-plan 帮我整理这段信息')).toEqual({
      name: 'research-plan',
      taskText: '帮我整理这段信息',
    });
  });

  it('allows empty task text after a valid skill name', () => {
    expect(parseSkillInvocationPrefix('/research-plan')).toEqual({
      name: 'research-plan',
      taskText: '',
    });
  });

  it('ignores non-leading or invalid skill prefixes', () => {
    expect(parseSkillInvocationPrefix('请使用 /research-plan')).toBeNull();
    expect(parseSkillInvocationPrefix('/Research-Plan task')).toBeNull();
    expect(parseSkillInvocationPrefix('/bad_name task')).toBeNull();
  });
});
