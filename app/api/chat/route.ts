import { MainAgent, type MainAgentUIMessage } from "@/agents/main"
import { createAgentUIStreamResponse } from "ai"

type ChatRequestBody = {
  messages: MainAgentUIMessage[]
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ChatRequestBody>

  if (!Array.isArray(body.messages)) {
    return Response.json(
      { error: "messages 必须是数组" },
      { status: 400 }
    )
  }

  return createAgentUIStreamResponse({
    agent: MainAgent,
    uiMessages: body.messages,
    abortSignal: request.signal,
    sendSources: true,
  })
}
