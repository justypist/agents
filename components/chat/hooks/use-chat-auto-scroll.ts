'use client';

import type { UIMessage } from 'ai';
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const AUTO_SCROLL_ENTER_THRESHOLD = 24;
const AUTO_SCROLL_EXIT_THRESHOLD = 80;

export function useChatAutoScroll(input: {
  messages: UIMessage[];
  status: string;
}): {
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesContentRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  updateAutoScrollState: () => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
} {
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesContentRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const documentVisibleRef = useRef(true);

  const updateAutoScrollState = useCallback((): void => {
    const container = messagesContainerRef.current;

    if (container == null) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (shouldAutoScrollRef.current) {
      shouldAutoScrollRef.current =
        distanceFromBottom <= AUTO_SCROLL_EXIT_THRESHOLD;
      return;
    }

    shouldAutoScrollRef.current =
      distanceFromBottom <= AUTO_SCROLL_ENTER_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto'): void => {
    const container = messagesContainerRef.current;

    if (container == null) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    shouldAutoScrollRef.current = true;
  }, []);

  useLayoutEffect(() => {
    if (!shouldAutoScrollRef.current || !documentVisibleRef.current) {
      return;
    }

    scrollToBottom();
  }, [input.messages, input.status, scrollToBottom]);

  useEffect(() => {
    const content = messagesContentRef.current;

    if (content == null) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (!shouldAutoScrollRef.current || !documentVisibleRef.current) {
        return;
      }

      scrollToBottom();
    });

    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, [scrollToBottom]);

  useEffect(() => {
    documentVisibleRef.current = document.visibilityState === 'visible';

    const handleVisibilityChange = (): void => {
      documentVisibleRef.current = document.visibilityState === 'visible';

      if (documentVisibleRef.current && shouldAutoScrollRef.current) {
        scrollToBottom();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scrollToBottom]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToBottom('smooth');
    });
  }, [scrollToBottom]);

  return {
    messagesContainerRef,
    messagesContentRef,
    messagesEndRef,
    updateAutoScrollState,
    scrollToBottom,
  };
}
