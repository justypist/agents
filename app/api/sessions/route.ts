import { CHAT_SESSION_PAGE_SIZE, listHomeChatSessions } from '@/lib/chat-session';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get('includeArchived') === '1';
  const page = parsePositiveInteger(searchParams.get('page')) ?? 1;
  const pageSize =
    parsePositiveInteger(searchParams.get('pageSize')) ?? CHAT_SESSION_PAGE_SIZE;
  const result = await listHomeChatSessions({
    includeArchived,
    page,
    pageSize,
  });

  return Response.json(result);
}

function parsePositiveInteger(value: string | null): number | null {
  if (value == null) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return null;
  }

  return parsedValue;
}
