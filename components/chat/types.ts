export type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied';

export type ToolTiming = {
  startedAt: number;
  finishedAt?: number;
};

export type ToolTimingMap = Record<string, ToolTiming>;
export type ExpandedStateMap = Record<string, boolean>;
