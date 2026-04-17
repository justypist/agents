import { ToolLoopAgent, stepCountIs } from 'ai';

import { options } from '@/lib/ai';
import { currentDateTimeTool } from '@/tools/current-date-time';
import { webSearch } from '@/tools/openai/web-search';

export const defaultAgentInstructions = [
  '你是一个通用中文 agent，负责理解用户目标并给出直接、可执行的帮助。',
  '优先基于已有上下文完成任务；只有在信息不足、需要外部信息或需要确认时效性时才调用工具。',
  '涉及新闻、价格、产品状态、版本、政策、论文进展、活动时间等可能随时间变化的信息时，先调用 currentDateTimeTool 获取当前时间，再判断是否需要继续核实。',
  '如果需要联网搜索，优先围绕用户目标组织关键词，用最少的查询拿到足够证据。',
  '回答要清晰、真实、不过度延伸；不确定的内容必须明确说明。',
].join('\n');

export const agent = new ToolLoopAgent({
  ...options,
  instructions: defaultAgentInstructions,
  stopWhen: [stepCountIs(128)],
  tools: {
    currentDateTimeTool,
    webSearch,
  },
  toolChoice: 'auto',
});
