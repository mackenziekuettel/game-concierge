import { connection, type NextRequest } from "next/server";
import { getTokenInfo } from "@/lib/shopify/auth";
import { listCatalogTools, searchCatalog } from "@/lib/shopify/catalog";
import { agentProfileUrl, GLOBAL_CATALOG_MCP_URL } from "@/lib/shopify/config";

export async function GET(request: NextRequest) {
  await connection();
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });

  try {
    const { scopes, expiresAt } = await getTokenInfo();
    const tools = await listCatalogTools();

    const query = request.nextUrl.searchParams.get("q");
    let search = null;
    if (query) {
      const res = await searchCatalog({ query, pagination: { limit: 3 } });
      const products = Array.isArray(res?.products) ? (res.products as { id?: string; title?: string }[]) : [];
      search = {
        query,
        ucp: res?.ucp ?? null,
        messages: res?.messages ?? [],
        productCount: products.length,
        products: products.map((p) => ({ id: p.id, title: p.title })),
      };
    }

    return Response.json({
      ok: true,
      auth: { scopes, expiresAt: new Date(expiresAt).toISOString() },
      catalog: { endpoint: GLOBAL_CATALOG_MCP_URL, agentProfile: agentProfileUrl(), tools },
      search,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
