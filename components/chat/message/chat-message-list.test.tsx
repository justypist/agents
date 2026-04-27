import type { UIMessage } from 'ai';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChatMessageList } from './chat-message-list';

const messages: UIMessage[] = [
  {
    id: 'message-1',
    role: 'user',
    parts: [{ type: 'text', text: 'Use this message' }],
  },
  {
    id: 'message-2',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Use this answer' }],
  },
];

describe('ChatMessageList skill selection', () => {
  it('shows selectable messages and lets users toggle a specific message', async () => {
    const user = userEvent.setup();
    const onSelectMessage = vi.fn();

    render(
      <ChatMessageList
        messages={messages}
        expandedStates={{}}
        isSelectingMessages
        selectedMessageIds={['message-2']}
        toolTimings={{}}
        status="ready"
        shouldShowPendingReply={false}
        messagesEndRef={{ current: null }}
        onSelectMessage={onSelectMessage}
        onToggleExpanded={vi.fn()}
      />,
    );

    expect(screen.getByText('Use this message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已选择' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '选择消息' }));

    expect(onSelectMessage).toHaveBeenCalledWith('message-1');
  });
});
