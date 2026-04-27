'use client';

import { isToolUIPart, type UIMessage } from 'ai';
import { useEffect, useRef, useState } from 'react';

import { isToolActive, isToolFinished } from '@/components/chat/helpers';
import type { ToolTimingMap } from '@/components/chat/types';

export function useToolTimings(messages: UIMessage[]): ToolTimingMap {
  const [toolTimings, setToolTimings] = useState<ToolTimingMap>({});
  const previousTimingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const timingKey = getToolTimingKey(messages);

    if (previousTimingKeyRef.current === timingKey) {
      return;
    }

    previousTimingKeyRef.current = timingKey;

    const currentTime = Date.now();
    setToolTimings(previous => {
      let changed = false;
      const next: ToolTimingMap = { ...previous };

      for (const message of messages) {
        for (const part of message.parts) {
          if (!isToolUIPart(part)) {
            continue;
          }

          const active = isToolActive(
            part.state,
            'preliminary' in part ? part.preliminary : undefined,
          );
          const finished = isToolFinished(
            part.state,
            'preliminary' in part ? part.preliminary : undefined,
          );
          const existingTiming = next[part.toolCallId];

          if (existingTiming == null) {
            next[part.toolCallId] = {
              startedAt: currentTime,
              finishedAt: finished ? currentTime : undefined,
            };
            changed = true;
            continue;
          }

          if (active && existingTiming.finishedAt != null) {
            next[part.toolCallId] = {
              startedAt: existingTiming.startedAt,
            };
            changed = true;
            continue;
          }

          if (finished && existingTiming.finishedAt == null) {
            next[part.toolCallId] = {
              startedAt: existingTiming.startedAt,
              finishedAt: currentTime,
            };
            changed = true;
          }
        }
      }

      return changed ? next : previous;
    });
  }, [messages]);

  return toolTimings;
}

function getToolTimingKey(messages: UIMessage[]): string {
  const keys: string[] = [];

  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolUIPart(part)) {
        continue;
      }

      keys.push(
        JSON.stringify([
          part.toolCallId,
          part.state,
          'preliminary' in part ? part.preliminary === true : false,
        ]),
      );
    }
  }

  return keys.join('\n');
}
