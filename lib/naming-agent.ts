import 'server-only';

import { streamText, type UIMessage } from 'ai';

import { options } from '@/lib/ai';

const namingAgentInstructions = [
  '你是一个中文会话命名 agent。',
  '请根据对话内容生成一个准确、简短的会话标题。',
  '标题必须是 6 到 18 个中文字符或等价长度的简短短语。',
  '不要使用书名号、引号、句号、冒号等多余标点。',
  '不要输出解释、前缀、编号或多行内容，只输出标题本身。',
].join('\n');

export async function generateChatSessionTitle(
  messages: UIMessage[],
): Promise<string | null> {
  const conversation = buildConversationSummary(messages);

  if (conversation == null) {
    return null;
  }

  try {
    const { text } = streamText({
      ...options.small,
      prompt: [namingAgentInstructions, '', conversation].join('\n'),
      maxOutputTokens: 32,
    });
    const normalizedTitle = normalizeTitle(await text);

    if (normalizedTitle == null) {
      return null;
    }

    return normalizedTitle;
  } catch {
    return null;
  }
}

function buildConversationSummary(messages: UIMessage[]): string | null {
  const lines: string[] = [];

  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue;
    }

    const text = message.parts
      .filter(part => part.type === 'text')
      .map(part => normalizeWhitespace(part.text))
      .filter(part => part.length > 0)
      .join(' ');

    if (text.length === 0) {
      continue;
    }

    lines.push(`${message.role === 'user' ? '用户' : '助手'}: ${truncateText(text, 120)}`);

    if (lines.length >= 6) {
      break;
    }
  }

  if (lines.length === 0) {
    return null;
  }

  return ['请为下面这段对话生成标题：', ...lines].join('\n');
}

function normalizeTitle(value: string): string | null {
  const normalizedValue = normalizeWhitespace(
    value
      .replace(/^标题[:：]\s*/u, '')
      .replace(/[「」『』【】"'`]/gu, ''),
  ).slice(0, 32);

  if (normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
