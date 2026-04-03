/**
 * AoN Elasticsearch Proxy — search Archives of Nethys for PF2e items
 *
 * GET /api/items/search-aon?search=longsword&category=equipment&level_min=0&level_max=20&rarity=common&size=50
 *
 * Proxies requests server-side to avoid CORS issues.
 * AoN endpoint: https://elasticsearch.aonprd.com/aon/_search
 */
import { NextRequest, NextResponse } from "next/server";

const AON_ENDPOINT = "https://elasticsearch.aonprd.com/aon/_search";

/** Lean shape returned to the client */
export interface AonItem {
  aonId: string;
  name: string;
  level: number;
  priceCp: number;
  priceRaw: string;
  bulk: number;
  bulkRaw: string;
  rarity: string;
  traits: string[];
  itemCategory: string;
  itemSubcategory: string;
  summary: string;
  url: string;
  usage: string;
  damage: string;
  hands: string;
  source: string;
}

/**
 * Map an AoN `_source` object to our lean AonItem shape.
 */
function mapHit(source: Record<string, unknown>, id: string): AonItem {
  return {
    aonId: id,
    name: (source.name as string) ?? "",
    level: (source.level as number) ?? 0,
    priceCp: (source.price as number) ?? 0,
    priceRaw: (source.price_raw as string) ?? "",
    bulk: (source.bulk as number) ?? 0,
    bulkRaw: (source.bulk_raw as string) ?? "—",
    rarity: (source.rarity as string) ?? "common",
    traits: (source.trait_raw as string[]) ?? (source.trait as string[]) ?? [],
    itemCategory: (source.item_category as string) ?? "",
    itemSubcategory: (source.item_subcategory as string) ?? "",
    summary: (source.summary as string) ?? "",
    url: (source.url as string) ?? "",
    usage: (source.usage as string) ?? "",
    damage: (source.damage as string) ?? "",
    hands: (source.hands as string) ?? "",
    source: (source.primary_source as string) ?? "",
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() ?? "";
    const category = searchParams.get("category") ?? "";
    const levelMin = parseInt(searchParams.get("level_min") ?? "0", 10);
    const levelMax = parseInt(searchParams.get("level_max") ?? "30", 10);
    const rarity = searchParams.get("rarity") ?? "";
    const size = Math.min(
      parseInt(searchParams.get("size") ?? "50", 10),
      200
    );

    if (!search && !category) {
      return NextResponse.json(
        { error: "Provide at least a search term or category" },
        { status: 400 }
      );
    }

    // Build Elasticsearch query DSL
    const mustClauses: Record<string, unknown>[] = [];
    const filterClauses: Record<string, unknown>[] = [];

    // Only return equipment + weapon + armor + shield categories
    const validAonCategories = [
      "equipment",
      "weapon",
      "armor",
      "shield",
    ];
    if (category && validAonCategories.includes(category.toLowerCase())) {
      filterClauses.push({ term: { category: category.toLowerCase() } });
    } else {
      // Default: search across all item-like categories
      filterClauses.push({
        terms: { category: validAonCategories },
      });
    }

    if (search) {
      mustClauses.push({
        multi_match: {
          query: search,
          fields: ["name^3", "text", "trait_raw"],
          type: "best_fields",
          fuzziness: "AUTO",
        },
      });
    }

    // Level range
    if (levelMin > 0 || levelMax < 30) {
      filterClauses.push({
        range: { level: { gte: levelMin, lte: levelMax } },
      });
    }

    // Rarity
    if (rarity) {
      filterClauses.push({ term: { rarity: rarity.toLowerCase() } });
    }

    // Exclude items marked hidden
    filterClauses.push({ term: { exclude_from_search: false } });

    const body = {
      size,
      _source: [
        "name",
        "level",
        "price",
        "price_raw",
        "bulk",
        "bulk_raw",
        "rarity",
        "trait",
        "trait_raw",
        "item_category",
        "item_subcategory",
        "summary",
        "url",
        "usage",
        "damage",
        "hands",
        "primary_source",
        "category",
      ],
      query: {
        bool: {
          must:
            mustClauses.length > 0
              ? mustClauses
              : [{ match_all: {} }],
          filter: filterClauses,
        },
      },
      sort: search
        ? ["_score", { level: "asc" }, { "name.keyword": "asc" }]
        : [{ level: "asc" }, { "name.keyword": "asc" }],
    };

    const esRes = await fetch(AON_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Cache for 5 minutes to be polite to AoN
      next: { revalidate: 300 },
    });

    if (!esRes.ok) {
      const text = await esRes.text();
      console.error("AoN ES error:", esRes.status, text);
      // Fall back to simple query-string search
      const fallbackUrl = `${AON_ENDPOINT}?q=${encodeURIComponent(
        `category:equipment ${search}`
      )}&size=${size}`;
      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) {
        return NextResponse.json(
          { error: "AoN search unavailable" },
          { status: 502 }
        );
      }
      const fallbackData = await fallbackRes.json();
      const items: AonItem[] = (
        fallbackData.hits?.hits ?? []
      ).map((hit: { _source: Record<string, unknown>; _id: string }) =>
        mapHit(hit._source, hit._id)
      );
      return NextResponse.json({
        items,
        total: fallbackData.hits?.total?.value ?? items.length,
      });
    }

    const data = await esRes.json();
    const items: AonItem[] = (data.hits?.hits ?? []).map(
      (hit: { _source: Record<string, unknown>; _id: string }) =>
        mapHit(hit._source, hit._id)
    );

    return NextResponse.json({
      items,
      total: data.hits?.total?.value ?? items.length,
    });
  } catch (error) {
    console.error("AoN search failed:", error);
    return NextResponse.json(
      { error: "AoN search failed" },
      { status: 500 }
    );
  }
}
