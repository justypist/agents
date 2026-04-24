export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export function jsonCreated<TData extends object>(data: TData): Response {
  return Response.json(data, { status: 201 });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}
