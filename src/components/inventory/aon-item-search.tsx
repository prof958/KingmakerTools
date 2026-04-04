"use client";

/**
 * AonItemSearch — reusable component for searching AoN's PF2e item database.
 *
 * Used in both AddItemDialog and WishList.
 */

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Globe, Loader2, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/pf2e/currency";

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

/** Map AoN item_category to our Prisma ItemCategory enum */
export function mapAonCategory(aonCat: string): string {
  const lower = aonCat.toLowerCase();
  if (lower.includes("weapon")) return "WEAPON";
  if (lower.includes("armor")) return "ARMOR";
  if (lower.includes("shield")) return "SHIELD";
  if (lower.includes("worn")) return "WORN";
  if (lower.includes("held")) return "HELD";
  if (lower.includes("consumable") || lower.includes("potion") || lower.includes("elixir"))
    return "CONSUMABLE";
  if (lower.includes("wand")) return "WAND";
  if (lower.includes("container") || lower.includes("backpack")) return "CONTAINER";
  if (lower.includes("material")) return "MATERIAL";
  if (
    lower.includes("gear") ||
    lower.includes("adventuring") ||
    lower.includes("tool")
  )
    return "GEAR";
  return "OTHER";
}

/** Map rarity string to our Prisma Rarity enum */
export function mapAonRarity(rarity: string): string {
  const r = rarity.toUpperCase();
  if (r === "COMMON" || r === "UNCOMMON" || r === "RARE" || r === "UNIQUE") return r;
  return "COMMON";
}

/** Build the payload to POST /api/items to persist an AoN item locally */
export function aonToItemPayload(aon: AonItem) {
  return {
    name: aon.name,
    bulkValue: aon.bulkRaw === "L" ? 0.1 : aon.bulk || 0,
    isBulkLight: aon.bulkRaw === "L",
    level: aon.level,
    rarity: mapAonRarity(aon.rarity),
    traits: aon.traits,
    category: mapAonCategory(aon.itemCategory || aon.itemSubcategory),
    valueCp: aon.priceCp || 0,
    isInvestable: (aon.usage || "").toLowerCase().includes("worn"),
    description: aon.summary || null,
  };
}

const RARITY_OPTIONS = [
  { value: "all", label: "Any Rarity" },
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "unique", label: "Unique" },
];

const RARITY_COLORS: Record<string, string> = {
  common: "",
  uncommon: "border-amber-500 text-amber-600 dark:text-amber-400",
  rare: "border-blue-500 text-blue-600 dark:text-blue-400",
  unique: "border-purple-500 text-purple-600 dark:text-purple-400",
};

interface AonItemSearchProps {
  onSelect: (item: AonItem) => void;
  disabled?: boolean;
}

export function AonItemSearch({ onSelect, disabled }: AonItemSearchProps) {
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("all");
  const [levelMin, setLevelMin] = useState("");
  const [levelMax, setLevelMax] = useState("");
  const [results, setResults] = useState<AonItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    if (!search.trim()) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      params.set("search", search.trim());
      if (rarity !== "all") params.set("rarity", rarity);
      if (levelMin) params.set("level_min", levelMin);
      if (levelMax) params.set("level_max", levelMax);
      params.set("size", "50");

      const res = await fetch(`/api/items/search-aon?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, rarity, levelMin, levelMax]);

  // Debounced search
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      return;
    }

    const timeout = setTimeout(doSearch, 500);
    return () => clearTimeout(timeout);
  }, [search, rarity, levelMin, levelMax, doSearch]);

  return (
    <div className="space-y-3 overflow-hidden">
      {/* Search input */}
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search AoN... (e.g., longsword, healing potion)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          disabled={disabled}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select
          value={rarity}
          onValueChange={(val) => setRarity(val ?? "all")}
          items={Object.fromEntries(RARITY_OPTIONS.map((r) => [r.value, r.label]))}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RARITY_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value} label={r.label}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input
            type="text"
            inputMode="numeric"
            placeholder="Min Lv"
            value={levelMin}
            onChange={(e) => { if (e.target.value === "" || /^\d*$/.test(e.target.value)) setLevelMin(e.target.value); }}
            className="w-[72px] h-8 text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="Max Lv"
            value={levelMax}
            onChange={(e) => { if (e.target.value === "" || /^\d*$/.test(e.target.value)) setLevelMax(e.target.value); }}
            className="w-[72px] h-8 text-xs"
          />
        </div>
      </div>

      {/* Results */}
      <div className="relative max-h-[250px] min-h-[80px] overflow-y-auto overflow-x-hidden space-y-1 rounded-md border border-dashed border-border/50 p-1">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-popover/80 backdrop-blur-[1px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Searching AoN…</span>
          </div>
        )}

        {results.map((item) => (
          <div
            key={item.aonId}
            className="flex items-center justify-between rounded-md border p-2 hover:bg-muted/50 cursor-pointer transition-colors overflow-hidden"
            onClick={() => !disabled && onSelect(item)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">
                  {item.name}
                </span>
                {item.level > 0 && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    Lv {item.level}
                  </Badge>
                )}
                {item.rarity !== "common" && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      RARITY_COLORS[item.rarity] ?? ""
                    }`}
                  >
                    {item.rarity}
                  </Badge>
                )}
                {item.source && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {item.source}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {item.itemCategory && (
                  <span className="text-[10px] text-muted-foreground">
                    {item.itemCategory}
                    {item.itemSubcategory ? ` / ${item.itemSubcategory}` : ""}
                  </span>
                )}
                {item.traits.length > 0 && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {item.traits.slice(0, 3).join(", ")}
                    {item.traits.length > 3 ? "…" : ""}
                  </span>
                )}
              </div>
              {item.summary && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {item.summary}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-muted-foreground shrink-0 ml-4">
              <div>
                {item.bulkRaw === "L"
                  ? "L"
                  : item.bulk
                    ? item.bulk
                    : "—"}{" "}
                Bulk
              </div>
              {item.priceCp > 0 && <div>{formatCurrency(item.priceCp)}</div>}
              {item.priceRaw && !item.priceCp && (
                <div>{item.priceRaw}</div>
              )}
              {item.url && (
                <a
                  href={`https://2e.aonprd.com${item.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 hover:text-foreground mt-0.5"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>AoN</span>
                </a>
              )}
            </div>
          </div>
        ))}

        {/* Status messages */}
        {searched && !loading && results.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            No items match your search on AoN.
          </p>
        )}
        {!searched && (
          <p className="text-center text-sm text-muted-foreground py-6">
            <Search className="inline h-4 w-4 mr-1" />
            Search the Archives of Nethys PF2e database
          </p>
        )}
        {searched && results.length > 0 && total > results.length && (
          <p className="text-center text-xs text-muted-foreground py-2">
            Showing {results.length} of {total.toLocaleString()} results. Refine
            your search for more specific results.
          </p>
        )}
      </div>

      {/* Scroll hint: shows result count below the list when scrollable */}
      {searched && !loading && results.length > 0 && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <span>{total.toLocaleString()} result{total !== 1 ? "s" : ""} found</span>
          {results.length > 3 && <span>↕ Scroll for more</span>}
        </div>
      )}
    </div>
  );
}
