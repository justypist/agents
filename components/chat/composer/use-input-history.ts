'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const INPUT_HISTORY_STORAGE_KEY = 'agents:chat-input-history';
const MAX_INPUT_HISTORY = 128;

export function useInputHistory(inputRef: RefObject<HTMLTextAreaElement | null>): {
  input: string;
  handleInputChange: (value: string) => void;
  handleHistoryNavigate: (direction: 'up' | 'down') => void;
  addSubmittedInput: (input: string) => void;
  clearInput: () => void;
} {
  const inputDraftRef = useRef('');
  const [input, setInput] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>(() =>
    readStoredInputHistory(),
  );
  const [inputHistoryIndex, setInputHistoryIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        INPUT_HISTORY_STORAGE_KEY,
        JSON.stringify(inputHistory),
      );
    } catch {
      // Ignore storage failures so input remains usable in restricted environments.
    }
  }, [inputHistory]);

  const moveCaretToInputEnd = useCallback((): void => {
    requestAnimationFrame(() => {
      const textarea = inputRef.current;

      if (textarea == null) {
        return;
      }

      const end = textarea.value.length;
      textarea.focus();
      textarea.setSelectionRange(end, end);
    });
  }, [inputRef]);

  const handleInputChange = useCallback(
    (value: string): void => {
      if (inputHistoryIndex != null) {
        inputDraftRef.current = value;
        setInputHistoryIndex(null);
      }

      setInput(value);
    },
    [inputHistoryIndex],
  );

  const handleHistoryNavigate = useCallback(
    (direction: 'up' | 'down'): void => {
      if (inputHistory.length === 0) {
        return;
      }

      if (direction === 'up') {
        const nextIndex =
          inputHistoryIndex == null
            ? inputHistory.length - 1
            : Math.max(inputHistoryIndex - 1, 0);

        if (inputHistoryIndex == null) {
          inputDraftRef.current = input;
        }

        setInputHistoryIndex(nextIndex);
        setInput(inputHistory[nextIndex]);
        moveCaretToInputEnd();
        return;
      }

      if (inputHistoryIndex == null) {
        return;
      }

      if (inputHistoryIndex === inputHistory.length - 1) {
        setInputHistoryIndex(null);
        setInput(inputDraftRef.current);
        moveCaretToInputEnd();
        return;
      }

      const nextIndex = inputHistoryIndex + 1;
      setInputHistoryIndex(nextIndex);
      setInput(inputHistory[nextIndex]);
      moveCaretToInputEnd();
    },
    [input, inputHistory, inputHistoryIndex, moveCaretToInputEnd],
  );

  const addSubmittedInput = useCallback((submittedInput: string): void => {
    setInputHistory(previous => appendInputHistory(previous, submittedInput));
  }, []);

  const clearInput = useCallback((): void => {
    inputDraftRef.current = '';
    setInputHistoryIndex(null);
    setInput('');
  }, []);

  return {
    input,
    handleInputChange,
    handleHistoryNavigate,
    addSubmittedInput,
    clearInput,
  };
}

export function shouldHandleHistoryNavigation(
  textarea: HTMLTextAreaElement,
  key: string,
): key is 'ArrowUp' | 'ArrowDown' {
  if (key !== 'ArrowUp' && key !== 'ArrowDown') {
    return false;
  }

  if (textarea.selectionStart !== textarea.selectionEnd) {
    return false;
  }

  const caret = textarea.selectionStart;

  if (key === 'ArrowUp') {
    return !textarea.value.slice(0, caret).includes('\n');
  }

  return !textarea.value.slice(caret).includes('\n');
}

function readStoredInputHistory(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(INPUT_HISTORY_STORAGE_KEY);

    if (stored == null) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .slice(-MAX_INPUT_HISTORY);
  } catch {
    return [];
  }
}

function appendInputHistory(history: string[], input: string): string[] {
  if (history[history.length - 1] === input) {
    return history;
  }

  return [...history, input].slice(-MAX_INPUT_HISTORY);
}
