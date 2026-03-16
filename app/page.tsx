import { ChatPanel } from "@/components/chat-panel"

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col p-4">
      <div className="flex flex-1 flex-col">
        <ChatPanel />
      </div>
    </main>
  )
}
