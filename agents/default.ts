import { ToolLoopAgent, stepCountIs } from 'ai';

import { options } from '@/lib/ai';
import { currentDateTime } from '@/tools/current-date-time';
import { tavilySearch } from '@/tools/tavily';
import { exec } from '@/tools/exec';
import { generateImage } from '@/tools/generate-image';

export const defaultAgentInstructions = [
  '你是一个通用中文 agent，负责理解用户目标并给出直接、可执行的帮助。',
  '优先基于已有上下文直接完成任务；需要外部信息、持久 workspace 或实际验证时，可依赖可用工具补足。',
  '回答要清晰、真实、不过度延伸；不确定的内容必须明确说明。',
].join('\n');

export const agent = new ToolLoopAgent({
  ...options.chat,
  instructions: defaultAgentInstructions,
  stopWhen: [stepCountIs(128)],
  tools: {
    currentDateTime,
    exec,
    generateImage,
    tavilySearch,
  },
  toolChoice: 'auto',
});
