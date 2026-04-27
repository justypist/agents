import type { UIMessage } from 'ai';
import { memo } from 'react';

import { ChatMessagePart } from './parts/chat-message-part';
import type { ExpandedStateMap, ToolTimingMap } from '../types';

type ChatMessageItemProps = {
  message: UIMessage;
  expandedStates: ExpandedStateMap;
  isSelectable?: boolean;
  isSelected?: boolean;
  toolTimings: ToolTimingMap;
  onSelectMessage?: (messageId: string) => void;
  onToggleExpanded: (key: string, currentExpanded: boolean) => void;
};

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  expandedStates,
  isSelectable = false,
  isSelected = false,
  toolTimings,
  onSelectMessage,
  onToggleExpanded,
}: ChatMessageItemProps) {
  return (
    <article className="border-b border-border pb-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {message.role === 'user' ? 'User' : 'Agent'}
        </p>
        {isSelectable ? (
          <button
            type="button"
            onClick={() => onSelectMessage?.(message.id)}
            className={`border px-2 py-1 text-xs transition ${
              isSelected
                ? 'border-border-strong bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-border-strong hover:bg-muted hover:text-foreground'
            }`}
          >
            {isSelected ? '已选择' : '选择消息'}
          </button>
        ) : null}
      </div>
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
    previous.isSelectable === next.isSelectable &&
    previous.isSelected === next.isSelected &&
    previous.toolTimings === next.toolTimings &&
    previous.onSelectMessage === next.onSelectMessage &&
    previous.onToggleExpanded === next.onToggleExpanded
  );
}
