import { AgentLinkCard } from '@/components/home/agent-link-card';
import { SessionHistory } from '@/components/home/session-history';
import { getRouteAgents } from '@/lib/agent-registry';
import { listHomeChatSessions } from '@/lib/chat-session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [agents, sessions] = await Promise.all([
    getRouteAgents(),
    listHomeChatSessions({
      page: 1,
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8 lg:px-12">
      <div className="max-w-2xl">
        <p className="text-sm text-muted-foreground">Agent Navigation</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          选择一个 Agent
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          首页展示当前已注册的 agent。点击任一入口后，会自动创建会话并进入对应页面。
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {agents.map(agent => (
          <AgentLinkCard
            key={agent.id}
            displayName={agent.displayName}
            href={`/${agent.routeSegment!}`}
            routeSegment={agent.routeSegment!}
          />
        ))}
      </div>

      <SessionHistory
        initialItems={sessions.items}
        initialHasMore={sessions.hasMore}
      />
    </main>
  );
}
