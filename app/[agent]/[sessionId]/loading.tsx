export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="border-b border-border px-4 py-3">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 border border-border bg-background" />
            <div className="h-4 w-36 bg-muted" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-20 bg-muted" />
            <div className="h-8 w-24 border border-border bg-background" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="border-b border-border pb-4 animate-pulse"
            >
              <div className="mb-3 h-3 w-12 bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-full max-w-2xl bg-muted" />
                <div className="h-4 w-3/4 bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-4xl animate-pulse">
          <div className="min-h-24 w-full border border-border bg-background" />
        </div>
      </div>
    </main>
  );
}
