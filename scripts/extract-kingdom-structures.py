"""
Generate the Kingdom structure catalog from the Kingmaker Player's Guide.

Writes src/lib/pf2e/kingdom-structures.ts: every structure with its level, lot
count, build cost, construction check, upgrade paths, item bonuses, and effects,
joined to the top-down tile extracted by extract-kingdom-assets.py.

The Vance & Kerenshara item-bonus additions are layered on top (VK_ITEM_BONUSES),
flagged so the UI can show which bonuses are house rules.

Run:  python scripts/extract-kingdom-structures.py
Needs: pymupdf  (dev-only; not part of the app runtime)
"""

import json
import re
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "docs" / "Kingmaker+Players+Guide.pdf"
TILES = ROOT / "public" / "kingdom" / "structures" / "manifest.json"
OUT = ROOT / "src" / "lib" / "pf2e" / "kingdom-structures.ts"
ACTIVITIES = ROOT / "src" / "lib" / "pf2e" / "kingdom-activities.ts"

STRUCTURE_PAGES = range(47, 59)
HEADER_STYLE = (12.0, "GoodOT-CondBold")
TRAIT_STYLE = (7.0, "GoodOT-CondBold")
FIELD_FONT = "GoodOT-Bold"
SIDEBAR_FONT = "Roundest-Bold"

PAGE_FURNITURE = re.compile(r"^(\d{1,3}|PLAYER.S GUIDE)$")
QUEST_SIDEBAR = re.compile(r"\(THE [A-Z' ]+\)$")
COLUMN_MARGINS = (90.0, 312.0)
INDENT_STOPS = tuple(
    tuple(margin + step for step in (0.0, 9.0, 18.0)) for margin in COLUMN_MARGINS
)

MARKER = ""

# Bold labels that open a field paragraph in a structure entry.
FIELDS = [
    "Lots",
    "Construction",
    "Upgrade From",
    "Upgrade To",
    "Item Bonus",
    "Effects",
    # Bank alone uses the singular. Without it the Item Bonus paragraph runs on
    # and swallows the effect text into the bonus's activity list.
    "Effect",
    "Ruin",
    "Requirements",
]

COMMODITIES = ("Lumber", "Luxuries", "Ore", "Stone")

MINOR_WORDS = {"a", "and", "of", "the", "to", "for", "in", "or"}

# The level label that closes a structure's heading. Most read "STRUCTURE 3",
# but a run of them say "BUILDING 3" instead, and Rubble has an em-dash where
# its level would be. Matching only "STRUCTURE <digit>" silently drops those
# entries and lets their text bleed into whichever entry precedes them.
LEVEL_LABEL = re.compile(r"\b(?:STRUCTURE|BUILDING)\s+(\d+|\S)\s*$")

# Item bonuses the V&K rules add, for activities RAW leaves without one.
# Keyed by structure slug; each entry is (bonus, [activities]).
VK_ITEM_BONUSES = {
    "bank": (1, ["Capital Investment", "Collect Taxes"]),
    "castle": (2, ["Manage Trade Agreements", "Relocate Capital"]),
    "construction-yard": (1, ["Build Roads", "Irrigation"]),
    "festival-hall": (1, ["Quell Unrest (Arts)"]),
    "garrison": (1, ["Fortify Hex"]),
    "granary": (1, ["Establish Farmland"]),
    "inn": (1, ["Clear Hex (Exploration)"]),
    "library": (1, ["Creative Solution"]),
    "magic-shop": (1, ["Prognostication"]),
    "monument": (1, ["Create a Masterpiece"]),
    "occult-shop": (2, ["Supernatural Solution"]),
    "palace": (3, ["Manage Trade Agreements", "Relocate Capital"]),
    "smithy": (1, ["Clear Hex (Engineering)"]),
    "tavern-dive": (1, ["Clear Hex (Exploration)"]),
    "tavern-luxury": (2, ["Reconnoiter Hex"]),
    "tavern-popular": (1, ["Reconnoiter Hex"]),
    "tavern-world-class": (3, ["Reconnoiter Hex"]),
    "town-hall": (1, ["Manage Trade Agreements"]),
}

# V&K also adds a construction requirement the printed entry lacks.
VK_CONSTRUCTION = {
    "granary": "Agriculture (trained)",
}

# The guide names a few structures differently from their tile captions.
TILE_ALIASES = {
    "alchemy-laboratory": "alchemy-lab",
    "specialized-artisan": "special-artisan",
    "arcanists-tower": "arcanist-tower",
    # The guide draws the waterfront as two tiles; the side piece is the one a
    # settlement uses for a straight stretch of shoreline.
    "waterfront": "waterfront-side",
}


def title_case(name):
    # str.title() capitalises after an apostrophe ("Arcanist'S"), so cap words
    # by hand instead.
    words = [w[:1].upper() + w[1:].lower() for w in name.split()]
    return " ".join(
        w if i == 0 or w.lower() not in MINOR_WORDS else w.lower()
        for i, w in enumerate(words)
    )


def slugify(name):
    name = name.lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", name).strip("-")


def tag_field(text):
    """Mark a line that opens a labelled field paragraph."""
    for field in sorted(FIELDS, key=len, reverse=True):
        if text.startswith(field + " "):
            key = field.lower().replace(" ", "_")
            return MARKER + key + " " + text[len(field) :].lstrip()
    return text


def visual_lines(doc):
    """One record per printed line, with same-baseline fragments stitched."""
    rows = {}
    for page_no in STRUCTURE_PAGES:
        for block in doc[page_no].get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"])
                if not text.strip():
                    continue
                x0, y0 = line["bbox"][0], line["bbox"][1]
                col = 0 if x0 < 300 else 1
                key = (page_no, col, round(y0 * 2) / 2)
                rows.setdefault(key, []).append((x0, text, line["spans"][0]))

    lines = []
    for (page_no, col, y), fragments in rows.items():
        fragments.sort()
        x0 = fragments[0][0]
        span = fragments[0][2]
        text = re.sub(r"\s+", " ", " ".join(f[1] for f in fragments)).strip()

        style = (round(span["size"], 1), span["font"])
        if style == HEADER_STYLE:
            kind = "header"
        elif style == TRAIT_STYLE:
            kind = "trait"
        elif span["font"] == SIDEBAR_FONT and span["size"] >= 10:
            kind = "sidebar"
        else:
            kind = "body"
            if span["font"] == FIELD_FONT:
                text = tag_field(text)

        if PAGE_FURNITURE.match(text):
            continue
        lines.append((page_no, col, y, kind, text, x0))

    lines.sort(key=lambda t: (t[0], t[1], t[2]))
    return lines


def drop_sidebars(lines):
    """Cut boxed inserts out, so the article text around them stays joined."""
    kept = []
    skipping = False
    for entry in lines:
        _page, col, _y, kind, text, x0 = entry
        if (kind == "header" and QUEST_SIDEBAR.search(text)) or kind == "sidebar":
            skipping = True
            continue
        if skipping:
            if kind == "header" or any(abs(x0 - s) < 0.5 for s in INDENT_STOPS[col]):
                skipping = False
            else:
                continue
        kept.append(entry)
    return kept


def parse_lots_and_cost(text):
    """'2; Cost 52 RP, 12 Lumber, 6 Luxuries, 12 Stone' -> lots + cost map."""
    # Infrastructure entries print an em-dash where the lot count would be:
    # walls, streets, and sewers sit on the grid without consuming a lot.
    lots = 0
    cost = {"rp": 0, "lumber": 0, "luxuries": 0, "ore": 0, "stone": 0}

    lots_match = re.match(r"\s*(\d+)", text)
    if lots_match:
        lots = int(lots_match.group(1))

    rp = re.search(r"(\d+)\s+RP", text)
    if rp:
        cost["rp"] = int(rp.group(1))
    for commodity in COMMODITIES:
        m = re.search(r"(\d+)\s+" + commodity, text, re.I)
        if m:
            cost[commodity.lower()] = int(m.group(1))
    return lots, cost


def parse_construction(text):
    """'Scholarship (expert) DC 27' -> skill, rank, DC."""
    m = re.match(r"([A-Za-z ]+?)\s*(?:\((\w+)\))?\s*DC\s*(\d+)", text.strip())
    if not m:
        return None
    return {
        "skill": m.group(1).strip().lower(),
        # No parenthesised rank means the check can be attempted untrained.
        "rank": (m.group(2) or "untrained").lower(),
        "dc": int(m.group(3)),
    }


def parse_item_bonus(text):
    """'+2 item bonus to Creative Solution' -> value + activity list."""
    m = re.match(r"\+(\d+)\s+item bonus(?:es)? to\s+(.+)", text.strip(), re.I)
    if not m:
        return None
    value = int(m.group(1))
    rest = re.split(r"\bchecks?\b", m.group(2))[0]

    # The Guildhall's bonus covers a whole ability's checks rather than any
    # named activity, so it needs its own target instead of being forced into
    # the activity list.
    ability = re.match(r"\s*(Culture|Economy|Loyalty|Stability)\s+skill\s*$", rest, re.I)
    if ability:
        return {"value": value, "activities": [], "ability": ability.group(1).lower()}

    activities = [
        a.strip(" .,;")
        for a in re.split(r",| and ", rest)
        if a.strip(" .,;")
    ]
    return {"value": value, "activities": activities}


def split_list(text):
    return [t.strip(" .,;") for t in re.split(r",| and ", text) if t.strip(" .,;")]


def read_entries(doc):
    lines = drop_sidebars(visual_lines(doc))
    starts = [
        n
        for n, entry in enumerate(lines)
        if entry[3] == "header" and LEVEL_LABEL.search(entry[4])
    ]

    entries = []
    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        header = lines[start][4]
        match = LEVEL_LABEL.search(header)
        name = header[: match.start()].strip()
        # Rubble's level is an em-dash: it is never deliberately built.
        level = int(match.group(1)) if match.group(1).isdigit() else 0

        body = lines[start + 1 : end]
        traits = []
        for _p, _c, _y, kind, text, _x in body:
            if kind == "trait":
                traits.extend(t.strip(",") for t in text.split())
        prose = " ".join(t for _p, _c, _y, kind, t, _x in body if kind == "body")
        entries.append(
            {
                "name": title_case(name.strip()),
                "level": level,
                "traits": traits,
                "text": prose,
            }
        )
    return entries


def build(entry, tiles):
    slug = slugify(entry["name"])
    parts = entry["text"].split(MARKER)

    record = {
        "id": slug,
        "name": entry["name"],
        "level": entry["level"],
        "lots": 1,
        "cost": {"rp": 0, "lumber": 0, "luxuries": 0, "ore": 0, "stone": 0},
        "traits": [t for t in entry["traits"] if t],
        "description": parts[0].strip(),
        "construction": None,
        "upgradeFrom": "",
        "upgradeTo": "",
        "itemBonuses": [],
        "effects": None,
        "ruin": None,
        "requirements": None,
    }

    seen_fields = set()
    for chunk in parts[1:]:
        key, _, value = chunk.partition(" ")
        value = value.strip()
        if key in seen_fields:
            record.setdefault("duplicateFields", []).append(key)
            continue
        seen_fields.add(key)
        if key == "lots":
            record["lots"], record["cost"] = parse_lots_and_cost(value)
        elif key == "construction":
            record["construction"] = parse_construction(value)
        elif key == "upgrade_from":
            record["upgradeFrom"] = value
        elif key == "upgrade_to":
            record["upgradeTo"] = value
        elif key == "item_bonus":
            bonus = parse_item_bonus(value)
            if bonus:
                record["itemBonuses"].append(bonus)
        elif key in ("effects", "effect"):
            record["effects"] = value
        elif key == "ruin":
            record["ruin"] = value
        elif key == "requirements":
            record["requirements"] = value

    vk = VK_ITEM_BONUSES.get(slug)
    if vk:
        record["itemBonuses"].append(
            {"value": vk[0], "activities": vk[1], "source": "VK"}
        )
    if slug in VK_CONSTRUCTION:
        record["vkConstruction"] = VK_CONSTRUCTION[slug]

    tile_slug = TILE_ALIASES.get(slug, slug)
    tile = tiles.get(tile_slug)
    record["tile"] = tile["file"] if tile else None
    # The printed lot count is authoritative; the tile art just has to match it.
    record["tileLots"] = tile["lots"] if tile else None
    return record


def known_activity_names():
    """Activity names from the generated activity catalog, longest first."""
    text = ACTIVITIES.read_text(encoding="utf-8")
    names = re.findall(r'^    name: "([^"]+)"', text, re.M)
    return sorted(names, key=len, reverse=True)


def resolve_activities(structures):
    """
    Replace the raw item-bonus activity text with catalog activity names.

    Same trap as the upgrade lists: "Rest and Relax" is one activity whose name
    contains "and", so splitting the sentence on conjunctions tears it in half.
    Matching against the known names keeps it whole. Text that matches nothing
    is kept verbatim rather than dropped, so a miss stays visible.
    """
    names = known_activity_names()

    for structure in structures:
        for bonus in structure["itemBonuses"]:
            if bonus.get("source") == "VK":
                continue  # hand-written above, already exact
            blob = " and ".join(bonus["activities"])
            remaining = blob
            found = []
            for name in names:
                index = remaining.lower().find(name.lower())
                if index >= 0:
                    found.append((index, name))
                    remaining = (
                        remaining[:index] + " " * len(name) + remaining[index + len(name):]
                    )
            if found:
                bonus["activities"] = [n for _i, n in sorted(found)]


def resolve_upgrades(structures):
    """
    Turn the raw upgrade text into structure ids.

    Several structure names contain a comma -- "tavern, popular", "wall, stone"
    -- so the lists cannot be split on punctuation. Matching longest-first
    against the catalog's own names keeps those names whole.
    """
    by_name = {s["name"].lower(): s["id"] for s in structures}
    names = sorted(by_name, key=len, reverse=True)

    def resolve(text):
        remaining = text.lower()
        found = []
        for name in names:
            if name in remaining:
                found.append((remaining.index(name), by_name[name]))
                remaining = remaining.replace(name, " " * len(name), 1)
        return [structure_id for _pos, structure_id in sorted(found)]

    for structure in structures:
        for field in ("upgradeFrom", "upgradeTo"):
            structure[field] = resolve(structure[field]) if structure[field] else []


def ts(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return "[" + ", ".join(ts(v) for v in value) + "]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        return "{ " + ", ".join(k + ": " + ts(v) for k, v in value.items()) + " }"
    text = (
        value.replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("�", "'")
        .replace("–", "-")
    )
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


HEADER = '''/**
 * Kingdom structure catalog - what a settlement can be built out of.
 *
 * GENERATED by scripts/extract-kingdom-structures.py from the Kingmaker
 * Player's Guide, joined to the top-down tiles under public/kingdom/structures
 * and layered with the Vance & Kerenshara item-bonus additions. Re-run the
 * script rather than editing the data below by hand.
 */

export interface StructureCost {
  rp: number;
  lumber: number;
  luxuries: number;
  ore: number;
  stone: number;
}

export interface StructureConstruction {
  /** Kingdom skill used for the Build Structure check. */
  skill: string;
  /** Proficiency rank the skill must reach. */
  rank: string;
  dc: number;
}

export interface StructureItemBonus {
  value: number;
  /** Activities the bonus applies to, as the guide names them. */
  activities: string[];
  /** Set instead of `activities` when the bonus covers a whole ability's checks. */
  ability?: string;
  /** Set when the bonus comes from the V&K house rules rather than RAW. */
  source?: "VK";
}

export interface KingdomStructureDef {
  id: string;
  name: string;
  level: number;
  /** Lots the structure occupies within a single block. */
  lots: number;
  cost: StructureCost;
  traits: string[];
  description: string;
  construction: StructureConstruction | null;
  upgradeFrom: string[];
  upgradeTo: string[];
  itemBonuses: StructureItemBonus[];
  effects: string | null;
  /** Ruin this structure inflicts while it stands, as the guide phrases it. */
  ruin: string | null;
  requirements: string | null;
  /** Top-down tile from the guide's Urban Grid sheets, if one exists. */
  tile: string | null;
  /** Lot count implied by the tile art, for cross-checking against `lots`. */
  tileLots: number | null;
  /** A construction requirement added by the V&K house rules. */
  vkConstruction?: string;
}

export const KINGDOM_STRUCTURES: KingdomStructureDef[] = [
'''

FOOTER = '''];

export function getKingdomStructure(id: string): KingdomStructureDef | undefined {
  return KINGDOM_STRUCTURES.find((s) => s.id === id);
}

/** Structures a settlement of the given kingdom level can build. */
export function structuresUpToLevel(level: number): KingdomStructureDef[] {
  return KINGDOM_STRUCTURES.filter((s) => s.level <= level);
}

/** Structures that fit in `lots` free lots. */
export function structuresFitting(lots: number): KingdomStructureDef[] {
  return KINGDOM_STRUCTURES.filter((s) => s.lots <= lots);
}
'''

FIELD_ORDER = (
    "id", "name", "level", "lots", "cost", "traits", "description",
    "construction", "upgradeFrom", "upgradeTo", "itemBonuses", "effects",
    "ruin", "requirements", "tile", "tileLots", "vkConstruction",
)  # duplicateFields is deliberately absent: diagnostics, not catalog data


def main():
    doc = pymupdf.open(PDF)
    tiles = json.loads(TILES.read_text(encoding="utf-8"))

    structures = [build(e, tiles) for e in read_entries(doc)]
    resolve_upgrades(structures)
    resolve_activities(structures)
    structures.sort(key=lambda s: s["name"])

    body = []
    for s in structures:
        body.append("  {")
        for key in FIELD_ORDER:
            if key in s:
                body.append("    " + key + ": " + ts(s[key]) + ",")
        body.append("  },")

    OUT.write_text(HEADER + "\n".join(body) + "\n" + FOOTER, encoding="utf-8")
    print(f"{len(structures)} structures -> {OUT}")

    # Infrastructure has no lot tile by design; only a building without one is
    # a sign the tile join went wrong.
    missing_tile = [
        s["name"]
        for s in structures
        if not s["tile"] and "INFRASTRUCTURE" not in s["traits"]
    ]
    if missing_tile:
        print("  building with no tile: " + ", ".join(missing_tile))
    mismatched = [
        f"{s['name']} (entry {s['lots']}, tile {s['tileLots']})"
        for s in structures
        if s["tileLots"] and s["lots"] and s["tileLots"] != s["lots"]
    ]
    if mismatched:
        print("  lot count disagrees with tile: " + "; ".join(mismatched))
    no_cost = [s["name"] for s in structures if s["cost"]["rp"] == 0]
    if no_cost:
        print("  no RP cost parsed: " + ", ".join(no_cost))
    dupes = [
        f"{s['name']} ({', '.join(s['duplicateFields'])})"
        for s in structures
        if s.get("duplicateFields")
    ]
    if dupes:
        print("  DUPLICATE FIELDS (a boundary was missed): " + "; ".join(dupes))


if __name__ == "__main__":
    main()
