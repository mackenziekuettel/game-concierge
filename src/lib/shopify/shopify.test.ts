import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function fakeToken(expSeconds: number, tag = "a") {
  const payload = Buffer.from(JSON.stringify({ scopes: "read_global_api_catalog_search", exp: expSeconds })).toString(
    "base64url",
  );
  return `header.${payload}.${tag}`;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
  process.env.SHOPIFY_CLIENT_ID = "id";
  process.env.SHOPIFY_CLIENT_SECRET = "secret";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const now = () => Math.floor(Date.now() / 1000);
const tokenCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("auth/access_token")).length;

describe("getAccessToken", () => {
  it("shares one token request between concurrent callers and reuses it until near expiry", async () => {
    fetchMock.mockImplementation(async () => json({ access_token: fakeToken(now() + 3600, String(tokenCalls())) }));
    const { getAccessToken } = await import("./auth");

    const [a, b] = await Promise.all([getAccessToken(), getAccessToken()]);
    expect(a).toBe(b);
    expect(tokenCalls()).toBe(1);

    vi.advanceTimersByTime(54 * 60 * 1000);
    expect(await getAccessToken()).toBe(a);

    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(await getAccessToken()).not.toBe(a);
    expect(tokenCalls()).toBe(2);
  });

  it("fails clearly when Shopify rejects the credentials", async () => {
    fetchMock.mockResolvedValue(json({ error: "invalid_client" }, 401));
    const { getAccessToken } = await import("./auth");
    await expect(getAccessToken()).rejects.toThrow("HTTP 401");
  });
});

describe("callTool", () => {
  it("sends a JSON-RPC tools/call with the UCP agent profile and returns structuredContent", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: fakeToken(now() + 3600) }))
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: 1, result: { structuredContent: { products: [] } } }));
    const { callTool } = await import("./mcp");

    const out = await callTool("https://catalog.shopify.com/api/ucp/mcp", "search_catalog", { catalog: { query: "azul" } });

    expect(out).toEqual({ products: [] });
    const [, init] = fetchMock.mock.calls[1];
    expect(init.headers.Authorization).toMatch(/^Bearer header\./);
    expect(JSON.parse(init.body)).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "search_catalog",
        arguments: {
          meta: { "ucp-agent": { profile: expect.stringMatching(/^https:\/\//) } },
          catalog: { query: "azul" },
        },
      },
    });
  });

  it("gets a fresh token and retries once when the catalog answers 401", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: fakeToken(now() + 3600, "old") }))
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(json({ access_token: fakeToken(now() + 3600, "new") }))
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: 1, result: { structuredContent: { ok: true } } }));
    const { callTool } = await import("./mcp");

    expect(await callTool("https://x.test/mcp", "search_catalog", {})).toEqual({ ok: true });
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toMatch(/\.new$/);
  });

  it("waits and retries when rate limited", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: fakeToken(now() + 3600) }))
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: 1, result: { structuredContent: { ok: true } } }));
    const { callTool } = await import("./mcp");

    const pending = callTool("https://x.test/mcp", "search_catalog", {});
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: true });
  });

  it("surfaces JSON-RPC errors", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: fakeToken(now() + 3600) }))
      .mockResolvedValueOnce(json({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Invalid params" } }));
    const { callTool } = await import("./mcp");
    await expect(callTool("https://x.test/mcp", "search_catalog", {})).rejects.toThrow("-32602: Invalid params");
  });
});
