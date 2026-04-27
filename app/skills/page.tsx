import { SkillsManager } from '@/components/skills/skills-manager';
import type { SkillView } from '@/components/skills/types';
import { listSkills, type Skill } from '@/lib/skills';

export const dynamic = 'force-dynamic';

export default async function SkillsPage() {
  const skills = await listSkills();

  return <SkillsManager initialSkills={skills.map(serializeSkill)} />;
}

function serializeSkill(skill: Skill): SkillView {
  return {
    id: skill.id,
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    content: skill.content,
    status: skill.status,
    sourceSessionId: skill.sourceSessionId,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };
}
