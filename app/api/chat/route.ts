import { MainAgent, type MainAgentUIMessage } from "@/agents/main"
import { convertToModelMessages, validateUIMessages } from "ai"

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

  const validatedMessages = await validateUIMessages<MainAgentUIMessage>({
    messages: body.messages,
    tools: MainAgent.tools,
  })

  const modelMessages = await convertToModelMessages(validatedMessages, {
    tools: MainAgent.tools,
    ignoreIncompleteToolCalls: true,
  })

  const result = await MainAgent.stream({
    prompt: modelMessages,
    abortSignal: request.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    sendSources: true,
  })
}
