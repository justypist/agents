import 'server-only';

import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { ModelMessage, ToolSet } from 'ai';

export type AgentStreamInput = {
  messages: ModelMessage[];
  abortSignal?: AbortSignal;
};

type StreamableAgent = {
  tools?: ToolSet;
  stream: (input: AgentStreamInput) => Promise<{
    toUIMessageStreamResponse: (options?: Record<string, unknown>) => Response;
  }>;
};

export type RegisteredAgent = {
  id: string;
  displayName: string;
  routeSegment?: string;
  agent: StreamableAgent;
};

type AgentRegistry = {
  agents: RegisteredAgent[];
  agentsById: Map<string, RegisteredAgent>;
  defaultAgent: RegisteredAgent;
  routeAgents: RegisteredAgent[];
  routeAgentsBySegment: Map<string, RegisteredAgent>;
};

const agentFilePattern = /^[a-z0-9-]+\.ts$/;
export const DEFAULT_AGENT_ID = 'default';
let registryPromise: Promise<AgentRegistry> | null = null;

export async function getRouteAgents(): Promise<RegisteredAgent[]> {
  const registry = await getRegistry();
  return registry.routeAgents;
}

export async function getAgentById(
  agentId: string,
): Promise<RegisteredAgent | null> {
  const registry = await getRegistry();
  return registry.agentsById.get(agentId) ?? null;
}

export async function getAgentByRouteSegment(
  segment: string,
): Promise<RegisteredAgent | null> {
  const registry = await getRegistry();
  return registry.routeAgentsBySegment.get(segment) ?? null;
}

export async function resolveRequestedAgent(
  agentId: string | undefined,
): Promise<RegisteredAgent | null> {
  return getAgentById(agentId ?? DEFAULT_AGENT_ID);
}

async function getRegistry(): Promise<AgentRegistry> {
  if (registryPromise == null) {
    registryPromise = loadRegistry();
  }

  return registryPromise;
}

async function loadRegistry(): Promise<AgentRegistry> {
  const agentDirectory = path.join(process.cwd(), 'agents');
  const agentFiles = (await readdir(agentDirectory))
    .filter(fileName => agentFilePattern.test(fileName))
    .sort();
  const agents = await Promise.all(
    agentFiles.map(async fileName => loadAgent(stripExtension(fileName))),
  );
  const defaultAgent = agents.find(agent => agent.id === DEFAULT_AGENT_ID);

  if (defaultAgent == null) {
    throw new Error(`Missing default agent "${DEFAULT_AGENT_ID}".`);
  }

  const agentsById = new Map<string, RegisteredAgent>();
  const routeAgentsBySegment = new Map<string, RegisteredAgent>();

  for (const agent of agents) {
    if (agentsById.has(agent.id)) {
      throw new Error(`Duplicate agent id "${agent.id}".`);
    }

    agentsById.set(agent.id, agent);

    if (agent.routeSegment == null) {
      throw new Error(`Agent "${agent.id}" is missing routeSegment.`);
    }

    if (routeAgentsBySegment.has(agent.routeSegment)) {
      throw new Error(`Duplicate route segment "${agent.routeSegment}".`);
    }

    routeAgentsBySegment.set(agent.routeSegment, agent);
  }

  return {
    agents,
    agentsById,
    defaultAgent,
    routeAgents: [...routeAgentsBySegment.values()],
    routeAgentsBySegment,
  };
}

async function loadAgent(moduleName: string): Promise<RegisteredAgent> {
  const importedModule = (await import(
    `../agents/${moduleName}`
  )) as Partial<Record<'agent', StreamableAgent>>;

  if (importedModule.agent == null) {
    throw new Error(`Agent module "${moduleName}" is missing agent export.`);
  }

  const routeSegment = moduleName;

  if (routeSegment != null && !isValidRouteSegment(routeSegment)) {
    throw new Error(
      `Agent "${moduleName}" has invalid route segment "${routeSegment}".`,
    );
  }

  return {
    id: moduleName,
    displayName: getAgentDisplayName(moduleName),
    routeSegment,
    agent: importedModule.agent,
  };
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.ts$/, '');
}

function isValidRouteSegment(segment: string): boolean {
  return /^[a-z0-9-]+$/.test(segment);
}

function getAgentDisplayName(moduleName: string): string {
  switch (moduleName) {
    case DEFAULT_AGENT_ID:
      return 'Agents';
    case 'chat':
      return 'Chat';
    case 'research':
      return 'Research';
    default:
      return moduleName
        .split('-')
        .filter(Boolean)
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
  }
}
