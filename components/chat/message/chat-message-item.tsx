import type { UIMessage } from 'ai';

import { ChatMessagePart } from './parts/chat-message-part';
import type { ExpandedStateMap, ToolTimingMap } from '../types';

type ChatMessageItemProps = {
  message: UIMessage;
  expandedStates: ExpandedStateMap;
  toolTimings: ToolTimingMap;
  now: number;
  onToggleExpanded: (key: string, currentExpanded: boolean) => void;
};

export function ChatMessageItem({
  message,
  expandedStates,
  toolTimings,
  now,
  onToggleExpanded,
}: ChatMessageItemProps) {
  return (
    <article className="border-b border-border pb-4">
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {message.role === 'user' ? 'User' : 'Agent'}
      </p>
      <div className="space-y-2 whitespace-pre-wrap break-words text-sm leading-7 tracking-[-0.01em]">
        {message.parts.map((part, index) => (
          <ChatMessagePart
            key={`${message.id}-${index}`}
            messageId={message.id}
            part={part}
            index={index}
            expandedStates={expandedStates}
            toolTimings={toolTimings}
            now={now}
            onToggleExpanded={onToggleExpanded}
          />
        ))}
      </div>
    </article>
  );
}
