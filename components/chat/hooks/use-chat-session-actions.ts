'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export function useChatSessionActions(input: {
  agentId: string;
  sessionId: string;
  initialTitle: string | null;
  fallbackTitle: string;
}): {
  currentTitle: string;
  isCreatingSession: boolean;
  isRegeneratingTitle: boolean;
  handleCreateSession: () => Promise<void>;
  handleRegenerateTitle: () => Promise<void>;
} {
  const router = useRouter();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(
    input.initialTitle ?? input.fallbackTitle,
  );

  useEffect(() => {
    setCurrentTitle(input.initialTitle ?? input.fallbackTitle);
  }, [input.fallbackTitle, input.initialTitle]);

  const handleCreateSession = useCallback(async (): Promise<void> => {
    if (isCreatingSession) {
      return;
    }

    setIsCreatingSession(true);

    try {
      const response = await fetch(`/api/${input.agentId}/sessions`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data: { chatPath?: string } = await response.json();

      if (typeof data.chatPath !== 'string' || data.chatPath.length === 0) {
        throw new Error('Missing chatPath');
      }

      router.push(data.chatPath);
    } catch {
      window.alert('新建会话失败，请稍后重试。');
      setIsCreatingSession(false);
    }
  }, [input.agentId, isCreatingSession, router]);

  const handleRegenerateTitle = useCallback(async (): Promise<void> => {
    if (isRegeneratingTitle) {
      return;
    }

    setIsRegeneratingTitle(true);

    try {
      const response = await fetch(`/api/sessions/${input.sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ regenerateTitle: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate title');
      }

      const data: { title?: string } = await response.json();

      if (typeof data.title !== 'string' || data.title.length === 0) {
        throw new Error('Missing title');
      }

      setCurrentTitle(data.title);
      router.refresh();
    } catch {
      window.alert('重新生成标题失败，请稍后重试。');
    } finally {
      setIsRegeneratingTitle(false);
    }
  }, [input.sessionId, isRegeneratingTitle, router]);

  return {
    currentTitle,
    isCreatingSession,
    isRegeneratingTitle,
    handleCreateSession,
    handleRegenerateTitle,
  };
}
