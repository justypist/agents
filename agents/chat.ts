import type { UIMessage } from 'ai';
import { ToolLoopAgent, stepCountIs } from 'ai';
import { options } from '@/lib/ai';

export const chatInstructions = [
  '你是一个简洁直接的中文助手。',
  '你只能聊天，不调用任何工具。',
  '优先给出清晰、准确、可执行的回答。',
].join('\n');

export const chatAgent = new ToolLoopAgent({
  ...options,
  instructions: chatInstructions,
  stopWhen: [stepCountIs(10)],
  tools: {},
  toolChoice: 'none',
});

export type ChatMessage = UIMessage;
