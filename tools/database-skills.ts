import { jsonSchema, tool } from 'ai';

import {
  getEnabledSkillById,
  searchEnabledSkills,
} from '@/lib/skills';

type SearchDatabaseSkillsInput = {
  query: string;
  limit?: number;
};

type ReadDatabaseSkillInput = {
  id: string;
};

const searchDatabaseSkillsInputSchema = jsonSchema<SearchDatabaseSkillsInput>({
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: '当前任务或需要复用的能力关键词',
    },
    limit: {
      type: 'integer',
      description: '最多返回的候选 skill 数量，默认 50，最大 100',
      minimum: 1,
      maximum: 100,
    },
  },
  required: ['query'],
  additionalProperties: false,
});

const readDatabaseSkillInputSchema = jsonSchema<ReadDatabaseSkillInput>({
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'searchDatabaseSkills 返回的 enabled skill id',
    },
  },
  required: ['id'],
  additionalProperties: false,
});

export const searchDatabaseSkillsTool = tool({
  description:
    '检索数据库中已启用的 skill 候选。需要复用用户沉淀的方法、流程、写作风格或操作规范时先调用；只返回摘要，不返回完整正文',
  inputSchema: searchDatabaseSkillsInputSchema,
  execute: async input => searchEnabledSkills(input),
});

export const readDatabaseSkillTool = tool({
  description:
    '读取一个已启用数据库 skill 的完整内容。必须使用 searchDatabaseSkills 返回的 id；不要读取文件系统中的 skill',
  inputSchema: readDatabaseSkillInputSchema,
  execute: async input => {
    const skill = await getEnabledSkillById(input.id);

    if (skill == null) {
      return { found: false as const };
    }

    return {
      found: true as const,
      skill: {
        id: skill.id,
        name: skill.name,
        displayName: skill.displayName,
        description: skill.description,
        content: skill.content,
        status: skill.status,
      },
    };
  },
});
