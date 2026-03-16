import { ChatPanel } from "@/components/chat-panel"

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col p-4">
      <header className="mb-4 border border-border px-3 py-2">
        <h1 className="text-base font-medium">Agents</h1>
        <p className="text-sm text-muted-foreground">
          纯文本界面，基础线框布局。
        </p>
      </header>

      <div className="flex flex-1 flex-col">
        <ChatPanel />
      </div>
    </main>
  )
}
