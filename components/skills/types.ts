export type SkillStatus = 'enabled' | 'disabled';

export type SkillView = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  content: string;
  status: SkillStatus;
  sourceSessionId: string | null;
  createdAt: string;
  updatedAt: string;
};
