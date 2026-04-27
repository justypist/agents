import 'server-only';

import {
  jsonSchema,
  NoObjectGeneratedError,
  Output,
  streamText,
  type UIMessage,
} from 'ai';

import { options } from '@/lib/ai';
import { getChatSession } from '@/lib/chat-session';
import {
  createSkill,
  getSkillById,
  parseCreateSkillInput,
  updateSkill,
  validateSkillName,
  type Skill,
} from '@/lib/skills';

export class SkillGenerationInputError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SkillGenerationInputError';
  }
}

type SkillContentDraft = {
  content: string;
};

type FullSkillDraft = {
  name: string;
  description: string;
  content: string;
};

type AdjustedSkillDraft = {
  description: string;
  content: string;
};

type RewriteSelectionDraft = {
  replacement: string;
};

const skillContentOutput = Output.object({
  name: 'skillContentDraft',
  description: 'Skill 正文草案。',
  schema: jsonSchema<SkillContentDraft>({
    type: 'object',
    properties: {
      content: { type: 'string', minLength: 1 },
    },
    required: ['content'],
    additionalProperties: false,
  }),
});

const fullSkillDraftOutput = Output.object({
  name: 'fullSkillDraft',
  description: '包含可调用名称、描述和正文的新 skill 草案。',
  schema: jsonSchema<FullSkillDraft>({
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      content: { type: 'string', minLength: 1 },
    },
    required: ['name', 'description', 'content'],
    additionalProperties: false,
  }),
});

const adjustedSkillDraftOutput = Output.object({
  name: 'adjustedSkillDraft',
  description: '调整已有 skill 后的描述和正文。',
  schema: jsonSchema<AdjustedSkillDraft>({
    type: 'object',
    properties: {
      description: { type: 'string', minLength: 1 },
      content: { type: 'string', minLength: 1 },
    },
    required: ['description', 'content'],
    additionalProperties: false,
  }),
});

const rewriteSelectionOutput = Output.object({
  name: 'rewriteSelectionDraft',
  description: '用于替换用户选中文本的候选内容。',
  schema: jsonSchema<RewriteSelectionDraft>({
    type: 'object',
    properties: {
      replacement: { type: 'string', minLength: 1 },
    },
    required: ['replacement'],
    additionalProperties: false,
  }),
});

export async function createSkillFromSession(input: {
  sessionId: string;
  messageIds: string[];
  name?: string;
  description?: string;
}): Promise<Skill> {
  const selectedMessages = await getSelectedMessages(input.sessionId, input.messageIds);
  const selectedText = buildSelectedConversation(selectedMessages);
  const hasUserFields = input.name != null || input.description != null;

  if (hasUserFields && (input.name == null || input.description == null)) {
    throw new SkillGenerationInputError(
      'Both name and description are required when pre-filling skill fields',
      400,
    );
  }

  if (input.name != null && input.description != null) {
    const validName = validateSkillName(input.name);

    if (!validName.ok) {
      throw new SkillGenerationInputError(validName.error, 400);
    }

    const content = await generateSkillContent({
      selectedText,
      name: validName.value,
      description: input.description,
    });
    const parsed = parseCreateSkillInput({
      name: validName.value,
      description: input.description,
      content,
      sourceSessionId: input.sessionId,
    });

    if (!parsed.ok) {
      throw new SkillGenerationInputError(parsed.error, 400);
    }

    return createSkill(parsed.value);
  }

  const draft = await generateFullSkillDraft(selectedText);
  const parsed = parseCreateSkillInput({
    ...draft,
    sourceSessionId: input.sessionId,
  });

  if (!parsed.ok) {
    throw new SkillGenerationInputError(parsed.error, 400);
  }

  return createSkill(parsed.value);
}

export async function adjustSkillFromSession(input: {
  sessionId: string;
  skillId: string;
  messageIds: string[];
  prompt?: string;
}): Promise<Skill> {
  const [selectedMessages, existingSkill] = await Promise.all([
    getSelectedMessages(input.sessionId, input.messageIds),
    getSkillById(input.skillId),
  ]);

  if (existingSkill == null) {
    throw new SkillGenerationInputError('Unknown skillId', 404);
  }

  const selectedText = buildSelectedConversation(selectedMessages);
  const { description, content } = await generateAdjustedSkillDraft({
    skill: existingSkill,
    selectedText,
    prompt: input.prompt,
  });
  const updatedSkill = await updateSkill(existingSkill.id, {
    description,
    content,
  });

  if (updatedSkill == null) {
    throw new SkillGenerationInputError('Unknown skillId', 404);
  }

  return updatedSkill;
}

export async function rewriteSkillSelection(input: {
  content: string;
  selection: string;
  prompt: string;
}): Promise<string> {
  const content = input.content.trim();
  const selection = input.selection.trim();
  const prompt = input.prompt.trim();

  if (content.length === 0 || selection.length === 0 || prompt.length === 0) {
    throw new SkillGenerationInputError(
      'Content, selection, and prompt are required',
      400,
    );
  }

  const { output } = streamText({
    ...options.small,
    output: rewriteSelectionOutput,
    system: [
      '你是 skill 编辑助手。',
      '生成用于替换选区的候选文本，不要解释。',
    ].join('\n'),
    prompt: [
      `用户改写要求：${prompt}`,
      '',
      '完整 skill 正文：',
      content,
      '',
      '需要改写的选区：',
      selection,
    ].join('\n'),
    maxOutputTokens: 1200,
  });
  const draft = await readStructuredOutput(
    output,
    'Failed to rewrite selection',
  );

  return normalizeRequiredText(draft.replacement, 'Failed to rewrite selection');
}

async function getSelectedMessages(
  sessionId: string,
  messageIds: string[],
): Promise<UIMessage[]> {
  if (messageIds.length === 0) {
    throw new SkillGenerationInputError('Select at least one message', 400);
  }

  const session = await getChatSession(sessionId);

  if (session == null) {
    throw new SkillGenerationInputError('Unknown sessionId', 404);
  }

  const messagesById = new Map(session.messages.map(message => [message.id, message]));
  const selectedMessages: UIMessage[] = [];

  for (const messageId of messageIds) {
    const message = messagesById.get(messageId);

    if (message == null) {
      throw new SkillGenerationInputError(
        'Selected message does not belong to session',
        400,
      );
    }

    selectedMessages.push(message);
  }

  return selectedMessages;
}

async function generateSkillContent(input: {
  selectedText: string;
  name: string;
  description: string;
}): Promise<string> {
  const { output } = streamText({
    ...options.small,
    output: skillContentOutput,
    system: buildSkillGeneratorSystemPrompt(),
    prompt: [
      '请根据选中的聊天消息，为已有名称和描述生成 skill 正文。',
      `name: ${input.name}`,
      `description: ${input.description}`,
      '',
      input.selectedText,
    ].join('\n'),
    maxOutputTokens: 1600,
  });
  const draft = await readStructuredOutput(
    output,
    'Failed to generate skill content',
  );

  return normalizeRequiredText(draft.content, 'Failed to generate skill content');
}

async function generateFullSkillDraft(selectedText: string): Promise<FullSkillDraft> {
  const { output } = streamText({
    ...options.small,
    output: fullSkillDraftOutput,
    system: buildSkillGeneratorSystemPrompt(),
    prompt: [
      '请根据选中的聊天消息生成一个新 skill 草案。',
      'name 必须是 lowercase kebab-case slug。',
      '',
      selectedText,
    ].join('\n'),
    maxOutputTokens: 1800,
  });

  return readStructuredOutput(output, 'Failed to generate skill draft');
}

async function generateAdjustedSkillDraft(input: {
  skill: Skill;
  selectedText: string;
  prompt?: string;
}): Promise<AdjustedSkillDraft> {
  const { output } = streamText({
    ...options.small,
    output: adjustedSkillDraftOutput,
    system: buildSkillGeneratorSystemPrompt(),
    prompt: [
      '请基于原 skill 内容和选中的聊天消息调整 skill。',
      '返回调整后的 description 和 content。不得修改 name。',
      input.prompt == null || input.prompt.trim().length === 0
        ? ''
        : `用户补充要求：${input.prompt.trim()}`,
      '',
      `原 skill name: ${input.skill.name}`,
      `原 description: ${input.skill.description}`,
      '原 content:',
      input.skill.content,
      '',
      input.selectedText,
    ].join('\n'),
    maxOutputTokens: 2000,
  });

  return readStructuredOutput(output, 'Failed to adjust skill draft');
}

function buildSkillGeneratorSystemPrompt(): string {
  return [
    '你是数据库 skill 生成助手。',
    'skill 是可复用的工作说明，应包含适用场景、步骤、约束和输出要求。',
    '只能使用用户明确选中的聊天消息作为新增依据，不要引入未提供的对话内容。',
  ].join('\n');
}

function buildSelectedConversation(messages: UIMessage[]): string {
  const lines = messages.flatMap(message => {
    const text = message.parts
      .filter(part => part.type === 'text')
      .map(part => part.text.trim())
      .filter(part => part.length > 0)
      .join('\n');

    if (text.length === 0) {
      return [];
    }

    return [`${message.role}: ${text}`];
  });

  if (lines.length === 0) {
    throw new SkillGenerationInputError('Selected messages do not contain text', 400);
  }

  return ['选中的聊天消息：', ...lines].join('\n');
}

function normalizeRequiredText(value: string, message: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new SkillGenerationInputError(message, 400);
  }

  return normalized;
}

async function readStructuredOutput<TValue>(
  output: PromiseLike<TValue>,
  message: string,
): Promise<TValue> {
  try {
    return await output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new SkillGenerationInputError(message, 400);
    }

    throw error;
  }
}
