import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import { memo } from 'react';

import { getReasoningText, isToolActive } from '../../helpers';
import type { ExpandedStateMap, ToolTimingMap } from '../../types';
import { FilePart } from './file-part';
import { ReasoningPart } from './reasoning-part';
import { TextPart } from './text-part';
import { ToolPart } from './tool-part';

type ChatMessagePartProps = {
  messageId: string;
  part: UIMessage['parts'][number];
  index: number;
  expandedStates: ExpandedStateMap;
  toolTimings: ToolTimingMap;
  onToggleExpanded: (key: string, currentExpanded: boolean) => void;
};

export const ChatMessagePart = memo(function ChatMessagePart({
  messageId,
  part,
  index,
  expandedStates,
  toolTimings,
  onToggleExpanded,
}: ChatMessagePartProps) {
  if (part.type === 'reasoning') {
    const reasoningText = getReasoningText(part.text);
    const reasoningKey = `${messageId}:${index}:reasoning`;
    const expanded = expandedStates[reasoningKey] ?? part.state === 'streaming';

    if (reasoningText.length === 0 && part.state !== 'streaming') {
      return null;
    }

    return (
      <ReasoningPart
        text={part.text}
        state={part.state}
        expanded={expanded}
        onToggle={() => onToggleExpanded(reasoningKey, expanded)}
      />
    );
  }

  if (part.type === 'text') {
    return <TextPart text={part.text} state={part.state} />;
  }

  if (part.type === 'file') {
    return <FilePart part={part} />;
  }

  if (!isToolUIPart(part)) {
    return null;
  }

  const preliminary = 'preliminary' in part ? part.preliminary : undefined;
  const expanded =
    expandedStates[part.toolCallId] ?? isToolActive(part.state, preliminary);

  return (
    <ToolPart
      toolCallId={part.toolCallId}
      toolName={getToolName(part)}
      state={part.state}
      preliminary={preliminary}
      input={'input' in part ? part.input : undefined}
      output={'output' in part ? part.output : undefined}
      errorText={'errorText' in part ? part.errorText : undefined}
      timing={toolTimings[part.toolCallId]}
      expanded={expanded}
      onToggle={() => onToggleExpanded(part.toolCallId, expanded)}
    />
  );
}, areChatMessagePartPropsEqual);

function areChatMessagePartPropsEqual(
  previous: ChatMessagePartProps,
  next: ChatMessagePartProps,
): boolean {
  return (
    previous.messageId === next.messageId &&
    previous.part === next.part &&
    previous.index === next.index &&
    previous.expandedStates === next.expandedStates &&
    previous.toolTimings === next.toolTimings &&
    previous.onToggleExpanded === next.onToggleExpanded
  );
}
