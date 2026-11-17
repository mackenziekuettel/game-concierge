import "server-only";

export const SHOPIFY_TOKEN_URL = "https://api.shopify.com/auth/access_token";
export const GLOBAL_CATALOG_MCP_URL = "https://catalog.shopify.com/api/ucp/mcp";
export const DEFAULT_AGENT_PROFILE_URL =
  "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";

export class ShopifyConfigError extends Error {}

export function shopifyCredentials() {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ShopifyConfigError("SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be set in .env.local");
  }
  return { clientId, clientSecret };
}

export function agentProfileUrl() {
  return process.env.UCP_AGENT_PROFILE_URL || DEFAULT_AGENT_PROFILE_URL;
}

export function savedCatalogId() {
  return process.env.SHOPIFY_CATALOG_ID || undefined;
}
