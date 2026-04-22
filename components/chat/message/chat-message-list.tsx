import type { UIMessage } from 'ai';
import type { RefObject } from 'react';

import { ChatEmptyState } from './chat-empty-state';
import { ChatMessageItem } from './chat-message-item';
import { PendingReply } from './pending-reply';
import type { ExpandedStateMap, ToolTimingMap } from '../types';

type ChatMessageListProps = {
  messages: UIMessage[];
  expandedStates: ExpandedStateMap;
  toolTimings: ToolTimingMap;
  status: string;
  shouldShowPendingReply: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onToggleExpanded: (key: string, currentExpanded: boolean) => void;
};

export function ChatMessageList({
  messages,
  expandedStates,
  toolTimings,
  status,
  shouldShowPendingReply,
  messagesEndRef,
  onToggleExpanded,
}: ChatMessageListProps) {
  if (messages.length === 0) {
    return <ChatEmptyState />;
  }

  return (
    <>
      {messages.map(message => (
        <ChatMessageItem
          key={message.id}
          message={message}
          expandedStates={expandedStates}
          toolTimings={toolTimings}
          onToggleExpanded={onToggleExpanded}
        />
      ))}
      {shouldShowPendingReply ? <PendingReply status={status} /> : null}
      <div ref={messagesEndRef} />
    </>
  );
}
