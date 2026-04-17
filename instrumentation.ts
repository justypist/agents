export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { initializeWebshareProxies } = await import("@/lib/webshare");

  const proxies = await initializeWebshareProxies();
  console.log({ proxies });
}
