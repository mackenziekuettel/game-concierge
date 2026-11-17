import "server-only";
import { clearAccessToken, getAccessToken } from "./auth";
import { agentProfileUrl } from "./config";

export type JsonRpcError = { code: number; message: string; data?: unknown };

export class McpError extends Error {
  constructor(
    message: string,
    readonly detail?: { status?: number; rpc?: JsonRpcError; content?: unknown },
  ) {
    super(message);
  }
}

let nextId = 1;

const MAX_RATE_LIMIT_RETRIES = 3;

function retryDelayMs(res: Response, attempt: number) {
  const header = Number(res.headers.get("retry-after"));
  return Number.isFinite(header) && header > 0 ? Math.min(header, 30) * 1000 : 1000 * 2 ** attempt;
}

async function post(url: string, body: unknown, retryOnUnauthorized: boolean, attempt = 0): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (res.status === 401 && retryOnUnauthorized) {
    clearAccessToken();
    return post(url, body, false, attempt);
  }
  if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
    await new Promise((r) => setTimeout(r, retryDelayMs(res, attempt)));
    return post(url, body, retryOnUnauthorized, attempt + 1);
  }
  if (!res.ok) throw new McpError(`MCP request to ${url} failed with HTTP ${res.status}`, { status: res.status });

  const payload = (await res.json()) as { result?: unknown; error?: JsonRpcError };
  if (payload.error) throw new McpError(`MCP error ${payload.error.code}: ${payload.error.message}`, { rpc: payload.error });
  return payload.result;
}

export function rpc(url: string, method: string, params?: Record<string, unknown>) {
  return post(url, { jsonrpc: "2.0", id: nextId++, method, ...(params ? { params } : {}) }, true);
}

type ToolResult = { structuredContent?: unknown; content?: unknown; isError?: boolean };

export async function callTool<T = unknown>(url: string, name: string, args: Record<string, unknown>): Promise<T> {
  const result = (await rpc(url, "tools/call", {
    name,
    arguments: { meta: { "ucp-agent": { profile: agentProfileUrl() } }, ...args },
  })) as ToolResult | undefined;

  if (result?.isError) throw new McpError(`Tool ${name} returned an error`, { content: result.content });
  return result?.structuredContent as T;
}
