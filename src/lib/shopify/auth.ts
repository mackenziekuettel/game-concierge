import "server-only";
import { SHOPIFY_TOKEN_URL, shopifyCredentials } from "./config";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const FALLBACK_LIFETIME_MS = 60 * 60 * 1000;

export type TokenInfo = { scopes: string | null; expiresAt: number };
type CachedToken = TokenInfo & { value: string };

export class ShopifyAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

let cached: CachedToken | null = null;
let inflight: Promise<CachedToken> | null = null;

function decodeClaims(token: string, now: number): TokenInfo {
  try {
    const [, payload] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const scopes = claims.scopes == null ? null : String(claims.scopes);
    const expiresAt = typeof claims.exp === "number" ? claims.exp * 1000 : now + FALLBACK_LIFETIME_MS;
    return { scopes, expiresAt };
  } catch {
    return { scopes: null, expiresAt: now + FALLBACK_LIFETIME_MS };
  }
}

async function requestToken(): Promise<CachedToken> {
  const { clientId, clientSecret } = shopifyCredentials();
  const res = await fetch(SHOPIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    cache: "no-store",
  });
  if (!res.ok) throw new ShopifyAuthError(`Shopify token request failed with HTTP ${res.status}`, res.status);

  const body = (await res.json()) as { access_token?: unknown };
  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new ShopifyAuthError("Shopify token response did not include access_token");
  }
  return { value: body.access_token, ...decodeClaims(body.access_token, Date.now()) };
}

export async function getAccessToken({ forceRefresh = false } = {}): Promise<string> {
  if (!forceRefresh && cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.value;
  inflight ??= requestToken().finally(() => {
    inflight = null;
  });
  cached = await inflight;
  return cached.value;
}

export async function getTokenInfo(): Promise<TokenInfo> {
  await getAccessToken();
  return { scopes: cached!.scopes, expiresAt: cached!.expiresAt };
}

export function clearAccessToken() {
  cached = null;
}
