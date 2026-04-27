import type { UIMessage } from 'ai';
import type { RefObject } from 'react';
import { memo } from 'react';

import { ChatEmptyState } from './chat-empty-state';
import { ChatMessageItem } from './chat-message-item';
import { PendingReply } from './pending-reply';
import type { ExpandedStateMap, ToolTimingMap } from '../types';

type ChatMessageListProps = {
  messages: UIMessage[];
  expandedStates: ExpandedStateMap;
  isSelectingMessages?: boolean;
  selectedMessageIds?: string[];
  toolTimings: ToolTimingMap;
  status: string;
  shouldShowPendingReply: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSelectMessage?: (messageId: string) => void;
  onToggleExpanded: (key: string, currentExpanded: boolean) => void;
};

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  expandedStates,
  isSelectingMessages = false,
  selectedMessageIds = [],
  toolTimings,
  status,
  shouldShowPendingReply,
  messagesEndRef,
  onSelectMessage,
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
          isSelectable={isSelectingMessages}
          isSelected={selectedMessageIds.includes(message.id)}
          toolTimings={toolTimings}
          onSelectMessage={onSelectMessage}
          onToggleExpanded={onToggleExpanded}
        />
      ))}
      {shouldShowPendingReply ? <PendingReply status={status} /> : null}
      <div ref={messagesEndRef} />
    </>
  );
}, areChatMessageListPropsEqual);

function areChatMessageListPropsEqual(
  previous: ChatMessageListProps,
  next: ChatMessageListProps,
): boolean {
  return (
    previous.messages === next.messages &&
    previous.expandedStates === next.expandedStates &&
    previous.isSelectingMessages === next.isSelectingMessages &&
    previous.selectedMessageIds === next.selectedMessageIds &&
    previous.toolTimings === next.toolTimings &&
    previous.status === next.status &&
    previous.shouldShowPendingReply === next.shouldShowPendingReply &&
    previous.messagesEndRef === next.messagesEndRef &&
    previous.onSelectMessage === next.onSelectMessage &&
    previous.onToggleExpanded === next.onToggleExpanded
  );
}
