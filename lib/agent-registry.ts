import 'server-only';

import type { ModelMessage, ToolSet } from 'ai';

import { agent as competitiveIntelligenceAgent } from '@/agents/competitive-intelligence';
import { agent as defaultAgent } from '@/agents/default';

export type AgentStreamInput = {
  messages: ModelMessage[];
  abortSignal?: AbortSignal;
};

type StreamableAgent = {
  tools?: ToolSet;
  stream: (input: AgentStreamInput) => Promise<{
    toUIMessageStream: (options?: Record<string, unknown>) => ReadableStream;
    toUIMessageStreamResponse: (options?: Record<string, unknown>) => Response;
  }>;
};

export type RegisteredAgent = {
  id: string;
  displayName: string;
  routeSegment?: string;
  agent: StreamableAgent;
};

export const DEFAULT_AGENT_ID = 'default';

const registeredAgents = [
  createRegisteredAgent({
    id: DEFAULT_AGENT_ID,
    displayName: 'Agents',
    routeSegment: DEFAULT_AGENT_ID,
    agent: defaultAgent,
  }),
  createRegisteredAgent({
    id: 'competitive-intelligence',
    displayName: 'Competitive Intelligence',
    routeSegment: 'competitive-intelligence',
    agent: competitiveIntelligenceAgent,
  }),
];

const agentsById = new Map(registeredAgents.map(agent => [agent.id, agent]));
const routeAgents = registeredAgents.filter(
  agent => agent.routeSegment != null,
);
const routeAgentsBySegment = new Map(
  routeAgents.map(agent => [agent.routeSegment, agent]),
);

if (!agentsById.has(DEFAULT_AGENT_ID)) {
  throw new Error(`Missing default agent "${DEFAULT_AGENT_ID}".`);
}

if (agentsById.size !== registeredAgents.length) {
  throw new Error('Duplicate agent id.');
}

if (routeAgents.length !== registeredAgents.length) {
  throw new Error('Agent is missing routeSegment.');
}

if (routeAgentsBySegment.size !== routeAgents.length) {
  throw new Error('Duplicate route segment.');
}

export async function getRouteAgents(): Promise<RegisteredAgent[]> {
  return routeAgents;
}

export async function getAgentById(
  agentId: string,
): Promise<RegisteredAgent | null> {
  return agentsById.get(agentId) ?? null;
}

export async function getAgentByRouteSegment(
  segment: string,
): Promise<RegisteredAgent | null> {
  return routeAgentsBySegment.get(segment) ?? null;
}

export async function resolveRequestedAgent(
  agentId: string | undefined,
): Promise<RegisteredAgent | null> {
  return getAgentById(agentId ?? DEFAULT_AGENT_ID);
}

function isValidRouteSegment(segment: string): boolean {
  return /^[a-z0-9-]+$/.test(segment);
}

function createRegisteredAgent(input: RegisteredAgent): RegisteredAgent {
  if (!isValidRouteSegment(input.routeSegment ?? '')) {
    throw new Error(
      `Agent "${input.id}" has invalid route segment "${input.routeSegment}".`,
    );
  }

  return input;
}
