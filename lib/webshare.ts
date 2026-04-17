import { config } from "@/config";

const GetProxyListURL = "https://proxy.webshare.io/api/v2/proxy/list/";

export type WebshareProxyMode = "direct" | "backbone";

export interface WebshareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  valid: boolean;
  last_verification: string | null;
  country_code: string;
  city_name: string | null;
  created_at: string;
}

export interface WebsharePaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface GetProxyListOptions {
  mode: WebshareProxyMode;
  page?: number;
  pageSize?: number;
  planId?: string;
  countryCodes?: string[];
  search?: string;
  ordering?: string | string[];
  createdAt?: string;
  proxyAddress?: string;
  proxyAddresses?: string[];
  valid?: boolean;
  asnNumber?: string;
  asnName?: string;
  signal?: AbortSignal;
}

let webshareProxiesInitializationPromise: Promise<string[]> | null = null;

const appendIfPresent = (
  searchParams: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined,
) => {
  if (value === undefined || value === null || value === "") {
    return;
  }

  searchParams.set(key, String(value));
};

const appendListIfPresent = (
  searchParams: URLSearchParams,
  key: string,
  values: string[] | undefined,
) => {
  if (!values || values.length === 0) {
    return;
  }

  searchParams.set(key, values.join(","));
};

const getErrorMessage = async (res: Response) => {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await res.json()) as Record<string, unknown>;
    return JSON.stringify(body);
  }

  return await res.text();
};

export const getProxyList = async ({
  mode,
  page,
  pageSize,
  planId,
  countryCodes,
  search,
  ordering,
  createdAt,
  proxyAddress,
  proxyAddresses,
  valid,
  asnNumber,
  asnName,
  signal,
}: GetProxyListOptions): Promise<WebsharePaginatedResponse<WebshareProxy>> => {
  const url = new URL(GetProxyListURL);

  appendIfPresent(url.searchParams, "mode", mode);
  appendIfPresent(url.searchParams, "page", page);
  appendIfPresent(url.searchParams, "page_size", pageSize);
  appendIfPresent(url.searchParams, "plan_id", planId);
  appendListIfPresent(url.searchParams, "country_code__in", countryCodes);
  appendIfPresent(
    url.searchParams,
    "ordering",
    Array.isArray(ordering) ? ordering.join(",") : ordering,
  );
  appendIfPresent(url.searchParams, "search", search);
  appendIfPresent(url.searchParams, "created_at", createdAt);
  appendIfPresent(url.searchParams, "proxy_address", proxyAddress);
  appendListIfPresent(url.searchParams, "proxy_address__in", proxyAddresses);
  appendIfPresent(url.searchParams, "valid", valid);
  appendIfPresent(url.searchParams, "asn_number", asnNumber);
  appendIfPresent(url.searchParams, "asn_name", asnName);

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Token ${config.webshare.apiKey}`,
    },
    signal,
  });

  if (!res.ok) {
    const details = await getErrorMessage(res);
    throw new Error(
      `Webshare proxy list request failed: ${res.status} ${res.statusText}${details ? ` - ${details}` : ""}`,
    );
  }

  return (await res.json()) as WebsharePaginatedResponse<WebshareProxy>;
};

const formatWebshareProxyUrl = (proxy: WebshareProxy) => {
  const username = encodeURIComponent(proxy.username);
  const password = encodeURIComponent(proxy.password);

  return `http://${username}:${password}@${proxy.proxy_address}:${proxy.port}`;
};

export const getAllProxies = async (
  mode: WebshareProxyMode = "direct",
): Promise<WebshareProxy[]> => {
  const pageSize = 100;
  const proxies: WebshareProxy[] = [];
  let page = 1;

  while (true) {
    const response = await getProxyList({
      mode,
      page,
      pageSize,
    });

    proxies.push(...response.results);

    if (!response.next || proxies.length >= response.count) {
      return proxies;
    }

    page += 1;
  }
};

export const initializeWebshareProxies = async (): Promise<string[]> => {
  if (webshareProxiesInitializationPromise) {
    return webshareProxiesInitializationPromise;
  }

  webshareProxiesInitializationPromise = (async () => {
    if (!process.env.WEBSHARE_API_KEY?.trim()) {
      config.webshare.proxies = [];
      return config.webshare.proxies;
    }

    const proxies = await getAllProxies("direct");
    config.webshare.proxies = proxies.filter(p => p.valid).map(formatWebshareProxyUrl);
    return config.webshare.proxies;
  })();

  try {
    return await webshareProxiesInitializationPromise;
  } catch (error) {
    webshareProxiesInitializationPromise = null;
    throw error;
  }
};

export const getProxyURL = (() => {
  let cursor = 0;

  return () => {
    if (config.webshare.proxies.length === 0) {
      return null
    }
    const idx = cursor++ % config.webshare.proxies.length
    const url = config.webshare.proxies[idx]
    return url
  }
})()