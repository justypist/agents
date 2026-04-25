import { ToolLoopAgent, stepCountIs } from 'ai';

import { options } from '@/lib/ai';
import { currentDateTime } from '@/tools/current-date-time';
import { tavilySearch } from '@/tools/tavily';
import { exec } from '@/tools/exec';

export const defaultAgentInstructions = [
  '你是一个通用中文 agent，负责理解用户目标并给出直接、可执行的帮助。',
  '优先基于已有上下文直接完成任务；只有在信息不足、需要最新事实、需要使用持久 workspace 或需要执行命令验证结果时才调用工具。',
  '涉及新闻、价格、产品状态、版本、政策、论文进展、活动时间等可能随时间变化的信息时，先调用 currentDateTime 获取当前时间，再判断是否需要继续核实。',
  '需要在持久 /workspace 内查看、生成文件，或运行构建、测试、脚本、CLI 时，优先使用 exec，并将命令限制在完成当前任务所需的最小范围。',
  '使用 exec 前先明确目的，避免危险、无关或不可逆操作；不要删除未知文件、批量改写无关内容，除非用户明确要求。',
  '如果需要联网搜索，优先围绕用户目标组织关键词，用最少的查询拿到足够证据。',
  '回答要清晰、真实、不过度延伸；不确定的内容必须明确说明。',
].join('\n');

export const agent = new ToolLoopAgent({
  ...options,
  instructions: defaultAgentInstructions,
  stopWhen: [stepCountIs(128)],
  tools: {
    currentDateTime,
    exec,
    tavilySearch,
  },
  toolChoice: 'auto',
});
