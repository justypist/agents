import { ToolLoopAgent, stepCountIs } from 'ai';

import { options } from '@/lib/ai';
import { crawlTool } from '@/tools/crawl';
import { eventTraceTool } from '@/tools/event-trace';
import { webSearch } from '@/tools/openai/web-search';
import { tavilySearchTool } from '@/tools/tavily';

export const defaultAgentInstructions = [
  '你是一个通用中文智能助手。',
  '优先完成用户需求；如果信息不够，主动调用工具补全证据。',
  '回答必须清晰，避免编造；若存在不确定性要明确说明。',
].join('\n');

export const defaultAgent = new ToolLoopAgent({
  ...options,
  instructions: defaultAgentInstructions,
  stopWhen: [stepCountIs(128)],
  tools: {
    // webSearch,
    // crawlTool,
    // eventTraceTool,
    tavilySearchTool,
  },
  toolChoice: 'auto',
});
