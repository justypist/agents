const SKILL_INVOCATION_PATTERN = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\s+([\s\S]*))?$/u;

export type ParsedSkillInvocation = {
  name: string;
  taskText: string;
};

export function parseSkillInvocationPrefix(
  value: string,
): ParsedSkillInvocation | null {
  const match = value.match(SKILL_INVOCATION_PATTERN);

  if (match == null) {
    return null;
  }

  const name = match[1];

  if (name == null) {
    return null;
  }

  return {
    name,
    taskText: match[2]?.trimStart() ?? '',
  };
}
