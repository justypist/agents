import Link from 'next/link';

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
          <Link
            key={agent.id}
            href={`/${agent.routeSegment}`}
            className="group rounded-2xl border border-border bg-background p-5 transition hover:border-border-strong hover:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  {agent.displayName}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  路径：/{agent.routeSegment}
                </p>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition group-hover:border-border-strong group-hover:text-foreground">
                打开
              </span>
            </div>
          </Link>
        ))}
      </div>

      <SessionHistory
        initialItems={sessions.items}
        initialHasMore={sessions.hasMore}
      />
    </main>
  );
}
