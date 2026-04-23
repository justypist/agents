import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center gap-4 border border-border bg-background px-8 py-10 text-center">
        <LoadingSpinner className="h-5 w-5" />
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">正在准备会话</p>
          <h1 className="text-xl font-medium text-foreground">马上进入聊天页面...</h1>
        </div>
      </div>
    </main>
  );
}
