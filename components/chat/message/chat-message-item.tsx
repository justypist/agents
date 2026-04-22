import type { UIMessage } from 'ai';
import { memo } from 'react';

import { ChatMessagePart } from './parts/chat-message-part';
import type { ExpandedStateMap, ToolTimingMap } from '../types';

type ChatMessageItemProps = {
  message: UIMessage;
  expandedStates: ExpandedStateMap;
  toolTimings: ToolTimingMap;
  onToggleExpanded: (key: string, currentExpanded: boolean) => void;
};

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  expandedStates,
  toolTimings,
  onToggleExpanded,
}: ChatMessageItemProps) {
  return (
    <article className="border-b border-border pb-4">
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {message.role === 'user' ? 'User' : 'Agent'}
      </p>
      <div className="space-y-2 break-words text-sm leading-7 tracking-[-0.01em]">
        {message.parts.map((part, index) => (
          <ChatMessagePart
            key={`${message.id}-${index}`}
            messageId={message.id}
            part={part}
            index={index}
            expandedStates={expandedStates}
            toolTimings={toolTimings}
            onToggleExpanded={onToggleExpanded}
          />
        ))}
      </div>
    </article>
  );
}, areChatMessageItemPropsEqual);

function areChatMessageItemPropsEqual(
  previous: ChatMessageItemProps,
  next: ChatMessageItemProps,
): boolean {
  return (
    previous.message === next.message &&
    previous.expandedStates === next.expandedStates &&
    previous.toolTimings === next.toolTimings &&
    previous.onToggleExpanded === next.onToggleExpanded
  );
}
