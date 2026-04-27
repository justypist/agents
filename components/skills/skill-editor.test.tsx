import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SkillEditor } from './skill-editor';

describe('SkillEditor rewrite flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rewrites a selected range, allows editing the candidate, and confirms replacement', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ candidate: 'better section' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    render(
      <SkillEditor
        value="first section second"
        onChange={onChange}
      />,
    );

    const editor = screen.getByPlaceholderText(
      '写下这个 skill 的触发场景、执行步骤、约束和输出格式...',
    ) as HTMLTextAreaElement;
    editor.setSelectionRange(6, 13);
    fireEvent.mouseUp(editor);

    await user.click(screen.getByRole('button', { name: 'AI 改写选区' }));
    await user.type(
      screen.getByPlaceholderText('例如：更具体、改成检查清单、压缩到三条'),
      'make better',
    );
    await user.click(screen.getByRole('button', { name: '生成候选' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('better section')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByDisplayValue('better section'), {
      target: { value: 'edited section' },
    });
    await user.click(screen.getByRole('button', { name: '确认回填' }));

    expect(onChange).toHaveBeenCalledWith('first edited section second');
  });
});
