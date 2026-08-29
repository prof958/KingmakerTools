"""
Generate the Kingdom activity catalog from the Kingmaker Player's Guide.

Writes src/lib/pf2e/kingdom-activities.ts. The V&K house-rule changes (two new
activities, two amended ones) are applied on top of the extracted RAW data --
see VK_NEW and VK_PATCH below.

Run:  python scripts/extract-kingdom-activities.py
Needs: pymupdf  (dev-only; not part of the app runtime)
"""

import re
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "docs" / "Kingmaker+Players+Guide.pdf"
OUT = ROOT / "src" / "lib" / "pf2e" / "kingdom-activities.ts"

# Two ranges rather than one span. The skill activities run to the first feats
# page, because the last one's text spills onto it and the feats that follow
# carry no turn-phase trait so they drop out anyway. The Army activities sit
# separately in the warfare chapter; the structure entries in between are
# skipped outright rather than relied on to filter themselves out.
ACTIVITY_PAGES = [*range(21, 36), *range(60, 64)]
SKILL_TABLE_PAGE = 19
HEADER_STYLE = (12.0, "GoodOT-CondBold")
TRAIT_STYLE = (7.0, "GoodOT-CondBold")

# Degree labels ("Critical Success", "Failure") are set in bold at the head of
# their paragraph. Tagging them by typeface is the only reliable split: the
# same words occur mid-sentence in the prose.
DEGREE_LABEL_FONT = "GoodOT-Bold"

# Private-use character, so it can never collide with the guide's own text.
MARKER = ""

DEGREES = ["Critical Success", "Critical Failure", "Success", "Failure"]
DEGREE_KEYS = {
    "Critical Success": "criticalSuccess",
    "Success": "success",
    "Failure": "failure",
    "Critical Failure": "criticalFailure",
}

# Page folios and running heads sit in the body font and would otherwise be
# spliced into the middle of a sentence.
PAGE_FURNITURE = re.compile(r"^(\d{1,3}|PLAYER.S GUIDE)$")

# NPC quest sidebars ("TAMERAK ELENARK (THE SCHOLAR)") are boxed inserts that
# sit at the top of a column while the article text resumes underneath them.
# They share the activity header style, so they have to be cut out of the line
# stream entirely -- treating one as a section boundary hands the article text
# that follows it to the sidebar instead.
QUEST_SIDEBAR = re.compile(r"\(THE [A-Z' ]+\)$")

# Article text sits on one of three exact indent stops per column: the margin,
# the hanging indent for a degree label, and its continuation. Sidebar prose is
# ragged-left and lands on arbitrary offsets, which is what tells them apart.
COLUMN_MARGINS = (90.0, 312.0)
INDENT_STOPS = tuple(
    tuple(margin + step for step in (0.0, 9.0, 18.0)) for margin in COLUMN_MARGINS
)

# The guide omits the LEADERSHIP trait on this one entry, but the skill table
# and the rules both treat it as a Leadership activity.
PHASE_OVERRIDES = {"new-leadership": "leadership"}

# Rules boxes ("BUILDING ON ROUGH TERRAIN", "NEGOTIATION DCS") are titled in
# this face rather than the article heading face.
SIDEBAR_FONT = "Roundest-Bold"

# Short words the guide leaves lowercase inside an activity name.
MINOR_WORDS = {"a", "and", "of", "the", "to", "for", "in", "or"}

PHASE_BY_TRAIT = {
    "LEADERSHIP": "leadership",
    "REGION": "region",
    "CIVIC": "civic",
    "COMMERCE": "commerce",
    "ARMY": "army",
}

SKILL_IDS = {
    "agriculture", "arts", "boating", "defense", "engineering", "exploration",
    "folklore", "industry", "intrigue", "magic", "politics", "scholarship",
    "statecraft", "trade", "warfare", "wilderness",
}

# Activities the V&K rules add outright.
VK_NEW = [
    {
        "id": "take-charge",
        "name": "Take Charge",
        "phase": "leadership",
        "skills": [],  # any skill the kingdom is trained in
        "traits": ["DOWNTIME", "LEADERSHIP"],
        "requirements": "Your kingdom must be at least Trained in the chosen skill.",
        "description": (
            "You spend some time getting directly involved in helping your kingdom. "
            "Choose a skill that your kingdom is at least Trained in, then attempt a "
            "basic check. You can never use the same skill for this activity twice in "
            "the same Kingdom turn."
        ),
        "outcomes": {
            "criticalSuccess": (
                "Gain 1 RP. In addition you get a +1 circumstance bonus to the next "
                "check you make this turn with the chosen skill."
            ),
            "success": "Gain 1 RP.",
            "failure": "You fail to generate RP.",
            "criticalFailure": (
                "You take a -1 circumstance penalty to the next check you make this "
                "turn with the chosen skill."
            ),
        },
        "skillChoice": "any",
        "anyMinRank": 1,
        "source": "VK",
    },
    {
        "id": "reconnoiter-hex",
        "name": "Reconnoiter Hex",
        "phase": "region",
        "skills": [
            {"skill": "exploration", "minRank": 0},
            {"skill": "wilderness", "minRank": 0},
        ],
        "traits": ["DOWNTIME", "REGION"],
        "requirements": None,
        "description": (
            "You send a team to spend time surveying and exploring a specific hex, "
            "getting the lay of the land and looking for unusual features and specific "
            "sites. Spend 1 RP and then attempt a basic check."
        ),
        "outcomes": {
            "criticalSuccess": (
                "The hex is now Reconnoitered for the purpose of Claim Hex. Your team "
                "automatically finds one Special or Hidden feature if the hex contains "
                "one, and avoids any Encounter or Hazard while reporting detailed "
                "information on it. You may immediately attempt an additional "
                "Reconnoiter Hex activity on an adjacent hex; treat a critical success "
                "on that check as a success instead."
            ),
            "success": (
                "The hex is now Reconnoitered for the purpose of Claim Hex. If the hex "
                "contains a Special feature your team may find it if your GM wishes. "
                "The team avoids any Encounter or Hazard and reports basic information."
            ),
            "failure": (
                "Your team fails to explore the hex sufficiently. The team escapes any "
                "Encounter or Hazard and reports basic information on it."
            ),
            "criticalFailure": (
                "Your team fails to explore the hex sufficiently and a number of the "
                "team are lost, causing you to take a -1 circumstance penalty to "
                "Loyalty-based checks until the end of your next Kingdom turn."
            ),
        },
        "source": "VK",
    },
]

# Activities whose skill is not fixed: chosen freely, or dictated by the
# structure being built.
SKILL_CHOICE = {
    "focused-attention": {"skillChoice": "any", "anyMinRank": 0},
    "build-structure": {"skillChoice": "structure"},
    # These resolve without a kingdom skill check of their own.
    "disband-army": {"skillChoice": "none"},
    "outfit-army": {"skillChoice": "none"},
    # The skill depends on which affliction is being recovered from.
    "recover-army": {"skillChoice": "varies"},
}

# Activities V&K amends rather than replaces.
VK_PATCH = {
    "capital-investment": {
        "requirements": (
            "You must be in the Capital or within the influence of a settlement that "
            "contains at least one Bank."
        ),
    },
    "request-foreign-aid": {
        "vkNote": (
            "The DC starts at the other group's Negotiation DC +2 and rises by 2 each "
            "consecutive turn you Request Foreign Aid from the same group, falling by 1 "
            "for each turn you do not (never below Negotiation DC +2). You may only "
            "request aid from a given group once per Kingdom turn."
        ),
    },
}


def tag_requirements(body):
    """
    Yield an entry's prose lines, marking off any Requirements block.

    A Requirements block is set as a hanging indent: the label sits on the
    column margin and its continuation lines are indented. The description that
    follows returns to the margin, which is what ends the block. Splitting on
    sentence punctuation instead leaves the rest of the requirements stranded at
    the front of the description.

    Entries that wrap around an illustration start indented and then widen back
    to the margin mid-sentence, so a return to the margin only ends the block
    once the requirements have actually reached the end of a sentence.
    """
    in_requirements = False
    previous = ""
    for _page, col, _y, kind, text, x0 in body:
        if kind != "body":
            continue
        if text.startswith("Requirements "):
            in_requirements = True
            previous = text
            yield MARKER + "requirements " + text[len("Requirements ") :]
            continue
        if (
            in_requirements
            and abs(x0 - COLUMN_MARGINS[col]) < 0.5
            and previous.rstrip().endswith((".", "!", ")"))
        ):
            in_requirements = False
            yield MARKER + "description " + text
            continue
        previous = text
        yield text


def tag_degree_label(text):
    """Mark a line that opens a degree-of-success paragraph."""
    for degree in DEGREES:  # longest first, so "Critical Success" wins
        if text.startswith(degree):
            return MARKER + DEGREE_KEYS[degree] + " " + text[len(degree) :].lstrip()
    return text


def title_case(name):
    words = name.title().split()
    return " ".join(
        w if i == 0 or w.lower() not in MINOR_WORDS else w.lower()
        for i, w in enumerate(words)
    )


def slugify(name):
    name = re.sub(r"\s*\(TRAINED\)\s*$", "", name, flags=re.I)
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def skill_table(doc):
    """activity name (lowered) -> [{skill, minRank}] from the summary table."""
    page = doc[SKILL_TABLE_PAGE]
    bounds = [(0, 195, "skill"), (195, 258, "ability"), (258, 378, 0), (378, 600, 1)]
    rows = {}
    for x0, y0, x1, y1, word, *_ in page.get_text("words"):
        if y0 < 96 or y0 > 705:
            continue
        col = next(c for lo, hi, c in bounds if lo <= x0 < hi)
        rows.setdefault(round(y0 / 4), {}).setdefault(col, []).append((x0, word))

    out = {}
    current = None
    for key in sorted(rows):
        row = {c: " ".join(w for _, w in sorted(v)) for c, v in rows[key].items()}
        if row.get("skill"):
            current = row["skill"].lower()
        if current not in SKILL_IDS:
            continue
        for rank in (0, 1):
            raw = row.get(rank, "").strip()
            name = re.sub(r"\s*\(master\)$", "", raw).rstrip("*").strip()
            if not name or name in {"—", "-", "�"}:
                continue
            min_rank = 3 if "(master)" in raw else rank
            out.setdefault(name.lower(), []).append(
                {"skill": current, "minRank": min_rank}
            )
    return out


def drop_sidebars(lines):
    """
    Remove boxed inserts from an ordered line stream.

    Two kinds interrupt the columns: NPC quest boxes, which share the article
    heading face, and rules boxes such as "BUILDING ON ROUGH TERRAIN", which are
    set in Roundest-Bold. Both sit inside a column while the article text
    continues around them, so their lines have to be cut out rather than used as
    section boundaries -- otherwise the prose that follows is attributed to the
    box and the activity it belongs to is left empty.
    """
    kept = []
    skipping = False
    for entry in lines:
        _page, col, _y, kind, text, x0 = entry
        if (kind == "header" and QUEST_SIDEBAR.search(text)) or kind == "sidebar":
            skipping = True
            continue
        if skipping:
            # The insert ends at the next real heading, or where the column's
            # own text resumes on an indent stop. Both are needed: an activity
            # that wraps around the same artwork stays indented well past the
            # box, and a box can run past the article text that follows it.
            resumed = any(abs(x0 - stop) < 0.5 for stop in INDENT_STOPS[col])
            if kind == "header" or resumed:
                skipping = False
            else:
                continue
        kept.append(entry)
    return kept


def visual_lines(doc):
    """
    One record per printed line, as (page, column, y, kind, text, x).

    Justified setting makes PyMuPDF hand back a single printed line as several
    fragments -- "Critical Success" arrives as "Critical" plus "Success ...".
    Fragments sharing a baseline are stitched back together here, before
    anything tries to read a degree label or a heading off the start of a line.
    """
    rows = {}
    for page_no in ACTIVITY_PAGES:
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
        # Separate fragments are separate words on the page, so they need a
        # space between them; the runs carry their own trailing spaces, hence
        # the collapse.
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
            if span["font"] == DEGREE_LABEL_FONT:
                text = tag_degree_label(text)

        if PAGE_FURNITURE.match(text):
            continue  # folio or running head, not activity prose
        lines.append((page_no, col, y, kind, text, x0))

    lines.sort(key=lambda t: (t[0], t[1], t[2]))
    return lines


def read_entries(doc):
    lines = visual_lines(doc)
    lines = drop_sidebars(lines)

    starts = [n for n, entry in enumerate(lines) if entry[3] == "header"]

    entries = []
    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(lines)
        body = lines[start + 1 : end]
        traits = []
        for _, _, _, kind, text, _x in body:
            if kind == "trait":
                traits.extend(text.split())
        prose = " ".join(tag_requirements(body))
        entries.append(
            {
                "name": lines[start][4],
                "traits": traits,
                "text": re.sub(r"\s+", " ", prose).strip(),
            }
        )
    return entries


def split_outcomes(text):
    """
    Return (description, requirements, outcomes) for one activity body.

    The sections are located by the markers planted while the lines were read --
    typeface for the degree labels, indentation for the requirements block --
    rather than by matching their words. Both label sets recur inside ordinary
    prose ("treat this result as a Success"), so word matching cuts entries
    short in the middle of a sentence.
    """
    requirements = None
    description_parts = []
    outcomes = {}

    parts = text.split(MARKER)
    description_parts.append(parts[0])

    for chunk in parts[1:]:
        key, _, body = chunk.partition(" ")
        body = body.strip()
        if key == "requirements":
            requirements = body
        elif key == "description":
            description_parts.append(body)
        elif key in DEGREE_KEYS.values() and key not in outcomes:
            outcomes[key] = re.split(r"\bSpecial\b", body)[0].strip()

    description = " ".join(p for p in description_parts if p.strip()).strip()
    return description, requirements, outcomes


# The guide names an activity's skills in more than one way: "attempt a basic
# Exploration check", but also "you can Deploy an Army with an Exploration,
# Boating, or Magic check". Matching only the first phrasing, and only its first
# occurrence, drops skills an activity really does allow.
SKILL_PHRASE = re.compile(
    r"(?:attempt|with|using|make)\s+(?:a|an)\s+(?:basic\s+)?([A-Za-z,\s]+?)\s+check"
)


def skills_from_text(text):
    """Every kingdom skill the entry names as usable for its check."""
    found = []
    for match in SKILL_PHRASE.finditer(text):
        for word in re.findall(r"[A-Z][a-z]+", match.group(1)):
            skill = word.lower()
            if skill in SKILL_IDS and skill not in found:
                found.append(skill)
    return found


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
 * Kingdom activity catalog - the verb layer of the Kingdom subsystem.
 *
 * GENERATED by scripts/extract-kingdom-activities.py from the Kingmaker
 * Player's Guide, with the Vance & Kerenshara changes applied on top: Take
 * Charge and Reconnoiter Hex are added, and Capital Investment and Request
 * Foreign Aid are amended. Re-run the script rather than editing the data
 * below by hand.
 */

import type { ProficiencyRank } from "./kingdom";

/** Which step of the Kingdom turn an activity belongs to. */
export type ActivityPhase =
  | "leadership"
  | "region"
  | "civic"
  | "commerce"
  | "army";

export const ACTIVITY_PHASE_LABELS: Record<ActivityPhase, string> = {
  leadership: "Leadership",
  region: "Region",
  civic: "Civic",
  commerce: "Commerce",
  army: "Army",
};

export interface ActivitySkillOption {
  skill: string;
  /** Lowest proficiency rank that unlocks this skill for the activity. */
  minRank: ProficiencyRank;
}

export interface ActivityOutcomes {
  criticalSuccess?: string;
  success?: string;
  failure?: string;
  criticalFailure?: string;
}

export interface KingdomActivityDef {
  id: string;
  name: string;
  phase: ActivityPhase;
  /** Skills that can attempt this. Empty when the player picks any skill. */
  skills: ActivitySkillOption[];
  traits: string[];
  requirements: string | null;
  description: string;
  outcomes: ActivityOutcomes;
  /**
   * Where the skill comes from when `skills` is empty. "any" lets the player
   * pick a Kingdom skill, "structure" takes it from the structure being built,
   * "varies" from a table the activity points at, and "none" means the
   * activity resolves without a check.
   */
  skillChoice?: "any" | "structure" | "varies" | "none";
  /** Lowest rank that qualifies when `skillChoice` is "any". */
  anyMinRank?: ProficiencyRank;
  /** Set when the activity exists only under the V&K house rules. */
  source?: "VK";
  /** A V&K amendment to an otherwise RAW activity. */
  vkNote?: string;
}

export const KINGDOM_ACTIVITIES: KingdomActivityDef[] = [
'''

FOOTER = '''];

export function getKingdomActivity(id: string): KingdomActivityDef | undefined {
  return KINGDOM_ACTIVITIES.find((a) => a.id === id);
}

/** Activities available during a given step of the Kingdom turn. */
export function activitiesForPhase(phase: ActivityPhase): KingdomActivityDef[] {
  return KINGDOM_ACTIVITIES.filter((a) => a.phase === phase);
}

/**
 * Activities a kingdom can attempt with `skill` at `rank`, including the
 * any-skill activities whose rank requirement it meets. Build Structure is
 * excluded: its skill comes from the structure, not from this list.
 */
export function activitiesForSkill(
  skill: string,
  rank: ProficiencyRank,
): KingdomActivityDef[] {
  return KINGDOM_ACTIVITIES.filter(
    (a) =>
      (a.skillChoice === "any" && rank >= (a.anyMinRank ?? 0)) ||
      a.skills.some((s) => s.skill === skill && rank >= s.minRank),
  );
}
'''

FIELD_ORDER = (
    "id", "name", "phase", "skills", "traits", "requirements",
    "description", "outcomes", "skillChoice", "anyMinRank", "source", "vkNote",
)


def main():
    doc = pymupdf.open(PDF)
    table = skill_table(doc)
    activities = []

    for entry in read_entries(doc):
        slug = slugify(entry["name"])
        if not any(t in PHASE_BY_TRAIT for t in entry["traits"]) and slug not in PHASE_OVERRIDES:
            continue  # a skill-section heading, not an activity
        display = title_case(entry["name"].replace("(TRAINED)", "").strip())
        description, requirements, outcomes = split_outcomes(entry["text"])

        phase = PHASE_OVERRIDES.get(slug, "leadership")
        for trait in entry["traits"]:
            if trait in PHASE_BY_TRAIT:
                phase = PHASE_BY_TRAIT[trait]
                break

        skills = list(table.get(display.lower(), []))
        known = {s["skill"] for s in skills}
        for skill in skills_from_text(entry["text"]):
            if skill not in known:
                skills.append({"skill": skill, "minRank": 0})
                known.add(skill)

        activity = {
            "id": slug,
            "name": display,
            "phase": phase,
            "skills": sorted(skills, key=lambda s: s["skill"]),
            "traits": entry["traits"],
            "requirements": requirements,
            "description": description,
            "outcomes": outcomes,
        }
        activity.update(SKILL_CHOICE.get(slug, {}))
        activity.update(VK_PATCH.get(slug, {}))
        activities.append(activity)

    activities.extend(VK_NEW)
    activities.sort(key=lambda a: a["name"])

    body = []
    for a in activities:
        body.append("  {")
        for key in FIELD_ORDER:
            if key in a:
                body.append("    " + key + ": " + ts(a[key]) + ",")
        body.append("  },")

    OUT.write_text(HEADER + "\n".join(body) + "\n" + FOOTER, encoding="utf-8")
    print(str(len(activities)) + " activities -> " + str(OUT))

    missing = [
        a["name"] for a in activities
        if not a["skills"] and not a.get("skillChoice")
    ]
    if missing:
        print("  no skills resolved for: " + ", ".join(missing))


if __name__ == "__main__":
    main()
