import { ToolLoopAgent, stepCountIs } from 'ai';

import { options } from '@/lib/ai';
import { currentDateTimeTool } from '@/tools/current-date-time';
import { pubmedSearchTool } from '@/tools/pubmed';

export const defaultAgentInstructions = [
  '你是一个通用中文智能助手。',
  '涉及新闻、价格、产品状态、版本、政策、论文进展、活动时间等时效性内容时，必须先调用 currentDateTimeTool 获取当前时间，再判断信息是否可能过期并按需继续核实。',
  '优先完成用户需求；如果信息不够，主动调用工具补全证据。',
  '回答必须清晰，避免编造；若存在不确定性要明确说明。',
].join('\n');

export const defaultAgent = new ToolLoopAgent({
  ...options,
  instructions: defaultAgentInstructions,
  stopWhen: [stepCountIs(128)],
  tools: {
    currentDateTimeTool,
    pubmedSearchTool,
  },
  toolChoice: 'auto',
});
