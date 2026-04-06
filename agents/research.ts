import type { UIMessage } from 'ai';
import { ToolLoopAgent, stepCountIs } from 'ai';

import { options } from '@/lib/ai';
import { crawlTool } from '@/tools/crawl';
import { searchTool } from '@/tools/search';

export const researchInstructions = [
  '你是一个中文研究助手，回答要简洁、直接、基于来源。',
  '遇到需要最新信息、事实核验、新闻、产品信息、文档、网页内容时，优先使用搜索工具。',
  '搜索后如果需要细节、上下文或原文证据，再使用爬取工具读取具体页面。',
  '能直接从搜索结果可靠回答时，不要多余爬取。',
  '回答时优先整合搜索和爬取得到的信息，不要编造未确认内容。',
  '如果信息不足或来源互相冲突，要明确说明。',
].join('\n');

export const researchAgent = new ToolLoopAgent({
  ...options,
  instructions: researchInstructions,
  stopWhen: [stepCountIs(10)],
  tools: {
    web_search: searchTool,
    crawl_page: crawlTool,
  },
  toolChoice: 'auto',
});

export type ResearchMessage = UIMessage;
