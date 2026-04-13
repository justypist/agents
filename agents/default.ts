import { ToolLoopAgent, stepCountIs } from 'ai';

import { options } from '@/lib/ai';
import { crawlTool } from '@/tools/crawl';
import { eventTraceTool } from '@/tools/event-trace';
import { webSearch } from '@/tools/openai/web-search';

export const defaultAgentInstructions = [
  '你是一个通用中文智能助手。',
  '优先完成用户需求；如果信息不够，主动调用工具补全证据。',
  '对于新闻、事实核验、产品/文档信息、网页内容，优先使用 webSearch。',
  '当用户需要追溯事件原委、时间线、起因与经过时，优先调用 eventTraceTool。',
  '需要读取具体网页细节时，使用 crawlTool 获取正文。',
  '回答必须清晰，避免编造；若存在不确定性要明确说明。',
].join('\n');

export const defaultAgent = new ToolLoopAgent({
  ...options,
  instructions: defaultAgentInstructions,
  stopWhen: [stepCountIs(128)],
  tools: {
    webSearch,
    crawlTool,
    eventTraceTool,
  },
  toolChoice: 'auto',
});
