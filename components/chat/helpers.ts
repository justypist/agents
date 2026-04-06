import type { ToolState } from './types';

const TOOL_LOG_LINE_LIMIT = 8;
const REASONING_LINE_LIMIT = 8;

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'submitted':
      return '请求已发送';
    case 'streaming':
      return '正在回复';
    case 'error':
      return '请求失败';
    default:
      return '准备就绪';
  }
}

export function getReasoningText(text: string): string {
  return text.trim();
}

export function getReasoningSummary(text: string): string {
  const normalizedText = getReasoningText(text).replace(/\s+/g, ' ');

  if (normalizedText.length === 0) {
    return '思考中';
  }

  if (normalizedText.length <= 72) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, 72)}...`;
}

export function getPendingReplyLabel(status: string): string {
  return status === 'submitted' ? '已收到，正在思考...' : '正在生成回复...';
}

export function formatJson(value: unknown): string {
  if (value == null) {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function getToolStateMeta(
  state: ToolState,
  preliminary?: boolean,
): {
  label: string;
  description: string;
} {
  switch (state) {
    case 'input-streaming':
      return {
        label: '参数生成中',
        description: '模型正在组织这次工具调用的参数。',
      };
    case 'input-available':
      return {
        label: '已发起调用',
        description: '参数已确定，工具正在执行。',
      };
    case 'approval-requested':
      return {
        label: '等待授权',
        description: '工具调用需要额外授权后才能继续。',
      };
    case 'approval-responded':
      return {
        label: '授权已处理',
        description: '授权状态已返回，等待后续执行结果。',
      };
    case 'output-available':
      return {
        label: preliminary ? '已返回阶段结果' : '调用完成',
        description: preliminary
          ? '工具先返回了一版中间结果。'
          : '工具调用已完成并返回结果。',
      };
    case 'output-error':
      return {
        label: '调用失败',
        description: '工具执行时报错。',
      };
    case 'output-denied':
      return {
        label: '执行被拒绝',
        description: '工具调用没有被允许执行。',
      };
    default:
      return {
        label: state,
        description: '',
      };
  }
}

export function isToolActive(state: ToolState, preliminary?: boolean): boolean {
  if (state === 'output-available') {
    return preliminary === true;
  }

  return (
    state === 'input-streaming' ||
    state === 'input-available' ||
    state === 'approval-requested' ||
    state === 'approval-responded'
  );
}

export function isToolFinished(state: ToolState, preliminary?: boolean): boolean {
  if (state === 'output-available') {
    return preliminary !== true;
  }

  return state === 'output-error' || state === 'output-denied';
}

export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 10000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  return `${Math.round(durationMs / 1000)}s`;
}

function toLatestLines(text: string, prefix: string): string[] {
  return text
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0)
    .map(line => `${prefix}${line}`);
}

export function getLatestReasoningLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(-REASONING_LINE_LIMIT);
}

export function getToolLiveLines(part: {
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  preliminary?: boolean;
}): string[] {
  const stateMeta = getToolStateMeta(part.state, part.preliminary);
  const lines: string[] = [`status  ${stateMeta.label}`];
  const inputText = formatJson(part.input);
  const outputText = formatJson(part.output);

  if (inputText) {
    lines.push(...toLatestLines(inputText, 'params  '));
  }

  if (outputText) {
    lines.push(...toLatestLines(outputText, 'output  '));
  }

  if (part.errorText) {
    lines.push(...toLatestLines(part.errorText, 'error   '));
  }

  return lines.slice(-TOOL_LOG_LINE_LIMIT);
}

export function getToolDetailLines(part: {
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  preliminary?: boolean;
}): string[] {
  const stateMeta = getToolStateMeta(part.state, part.preliminary);
  const lines: string[] = [`status  ${stateMeta.label}`];
  const inputText = formatJson(part.input);
  const outputText = formatJson(part.output);

  if (inputText) {
    lines.push(...toLatestLines(inputText, 'params  '));
  }

  if (outputText) {
    lines.push(...toLatestLines(outputText, 'output  '));
  }

  if (part.errorText) {
    lines.push(...toLatestLines(part.errorText, 'error   '));
  }

  return lines;
}
