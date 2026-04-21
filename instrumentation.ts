export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { initializeWebshareProxies } = await import('@/lib/webshare');

  const proxies = await initializeWebshareProxies();
  console.log(`[webshare loaded] ${proxies.length} proxies`)

  const { config } = await import('@/config')
  console.log(`[tavily loaded] ${config.tavily.apiKeys.length} keys`)
}
