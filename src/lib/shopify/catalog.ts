import "server-only";
import { GLOBAL_CATALOG_MCP_URL, savedCatalogId } from "./config";
import { callTool, rpc } from "./mcp";
import { summarizeProduct } from "./product";

// Argument shapes follow shopify.dev/docs/agents/catalog/global-catalog.
// Response bodies are left loose until the UI needs specific fields.

export type CatalogContext = {
  address_country?: string;
  address_region?: string;
  postal_code?: string;
  language?: string;
  currency?: string;
  intent?: string;
};

export type CatalogFilters = Record<string, unknown>;

export type SearchCatalogArgs = {
  query?: string;
  catalog_id?: string;
  like?: unknown[];
  context?: CatalogContext;
  filters?: CatalogFilters;
  pagination?: { cursor?: string; limit?: number };
};

export type LookupCatalogArgs = { ids: string[]; filters?: CatalogFilters; context?: CatalogContext };

export type GetProductArgs = {
  id: string;
  selected?: { name: string; label: string }[];
  preferences?: string[];
  filters?: CatalogFilters;
  context?: CatalogContext;
};

export type UcpResponse = {
  ucp?: { version?: string; capabilities?: Record<string, unknown> };
  messages?: { type?: string; code?: string; content?: string }[];
  [key: string]: unknown;
};

export async function listCatalogTools(): Promise<string[]> {
  const result = (await rpc(GLOBAL_CATALOG_MCP_URL, "tools/list")) as { tools?: { name: string }[] } | undefined;
  return result?.tools?.map((t) => t.name) ?? [];
}

export function searchCatalog(args: SearchCatalogArgs) {
  const catalog_id = args.catalog_id ?? savedCatalogId();
  return callTool<UcpResponse>(GLOBAL_CATALOG_MCP_URL, "search_catalog", {
    catalog: { ...args, ...(catalog_id ? { catalog_id } : {}) },
  });
}

export function lookupCatalog(args: LookupCatalogArgs) {
  return callTool<UcpResponse>(GLOBAL_CATALOG_MCP_URL, "lookup_catalog", { catalog: args });
}

export function getProduct(args: GetProductArgs) {
  return callTool<UcpResponse>(GLOBAL_CATALOG_MCP_URL, "get_product", { catalog: args });
}

export type Pagination = { cursor?: string; hasNextPage?: boolean; totalCount?: number };

function pagination(v: unknown): Pagination | undefined {
  if (!v || typeof v !== "object") return undefined;
  const p = v as Record<string, unknown>;
  return {
    cursor: typeof p.cursor === "string" ? p.cursor : undefined,
    hasNextPage: typeof p.has_next_page === "boolean" ? p.has_next_page : undefined,
    totalCount: typeof p.total_count === "number" ? p.total_count : undefined,
  };
}

export async function searchProducts(query: string, options: Omit<SearchCatalogArgs, "query"> = {}) {
  const res = await searchCatalog({ query, ...options });
  return {
    products: Array.isArray(res?.products) ? res.products.map(summarizeProduct) : [],
    pagination: pagination(res?.pagination),
    messages: res?.messages ?? [],
  };
}

export async function getProductDetails(id: string, options: Omit<GetProductArgs, "id"> = {}) {
  const res = await getProduct({ id, ...options });
  return {
    product: res?.product ? summarizeProduct(res.product) : null,
    messages: res?.messages ?? [],
  };
}
