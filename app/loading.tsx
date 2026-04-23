export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-1 flex-col px-6 py-12 sm:px-8 lg:px-12">
      <div className="max-w-2xl animate-pulse space-y-4">
        <div className="h-4 w-32 bg-muted" />
        <div className="h-10 w-56 bg-muted" />
        <div className="h-5 w-full max-w-xl bg-muted" />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-border bg-background p-5"
          >
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-36 bg-muted" />
              <div className="h-4 w-28 bg-muted" />
            </div>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-28 bg-muted" />
            <div className="h-8 w-40 bg-muted" />
          </div>
          <div className="h-9 w-24 animate-pulse border border-border bg-background" />
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-background">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1 animate-pulse space-y-2">
                <div className="h-4 w-52 bg-muted" />
                <div className="h-3 w-36 bg-muted" />
              </div>
              <div className="h-8 w-20 animate-pulse border border-border bg-background" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
