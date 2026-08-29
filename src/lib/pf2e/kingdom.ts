/**
 * PF2e Kingmaker — Kingdom Building rules engine
 *
 * Pure, stateless data + calculators for the Kingdom subsystem. No DB, no I/O.
 *
 * Two rulesets are supported:
 *  - "RAW" — Kingmaker Player's Guide, rules as written
 *  - "VK"  — Vance & Kerenshara's Comprehensive Kingdom Building Rule Changes
 *            (the house rules this group plays with; the app default)
 *
 * The rulesets diverge only in advancement (skill increases, ability boosts,
 * Untrained Improvisation) and in the number of free boosts chosen at kingdom
 * creation. Control DC, ability math, the skill list, leadership roles, and the
 * Size table are identical between them.
 */

// ──────────────────────────────────────────────
// Rulesets
// ──────────────────────────────────────────────

export type KingdomRuleset = "RAW" | "VK";

export const DEFAULT_RULESET: KingdomRuleset = "VK";

// ──────────────────────────────────────────────
// Abilities
// ──────────────────────────────────────────────

export const KINGDOM_ABILITIES = [
  "culture",
  "economy",
  "loyalty",
  "stability",
] as const;

export type KingdomAbility = (typeof KINGDOM_ABILITIES)[number];

export const ABILITY_LABELS: Record<KingdomAbility, string> = {
  culture: "Culture",
  economy: "Economy",
  loyalty: "Loyalty",
  stability: "Stability",
};

/** Kingdom ability modifier — same formula as PF2e character abilities. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Apply a boost to a score. Boosts add +2 while the score is below 18, and
 * only +1 once it is 18 or higher (Player's Guide, "Ability Boosts").
 */
export function applyBoost(score: number): number {
  return score >= 18 ? score + 1 : score + 2;
}

/** Apply a flaw to a score (−2, no floor in the rules but clamped at 0 here). */
export function applyFlaw(score: number): number {
  return Math.max(0, score - 2);
}

// ──────────────────────────────────────────────
// Charter (KPG 12)
// ──────────────────────────────────────────────

export interface CharterDef {
  id: string;
  name: string;
  /** Fixed ability boost, or null for the open charter. */
  boost: KingdomAbility | null;
  /** Fixed ability flaw, or null for the open charter. */
  flaw: KingdomAbility | null;
  /** Every charter also grants one free boost. */
  freeBoost: true;
  /**
   * VK only — the Kingdom skill this charter trains. RAW charters grant no
   * skills at all. null means the player picks freely (the open charter).
   */
  grantedSkill: string | null;
  description: string;
}

export const CHARTERS: CharterDef[] = [
  {
    id: "conquest",
    name: "Conquest",
    boost: "loyalty",
    flaw: "culture",
    freeBoost: true,
    grantedSkill: "warfare",
    description:
      "Your sponsors conquered the area and command you to hold and pacify it. The people are devoted (partly from fear), but the threat of war hinders the arts.",
  },
  {
    id: "expansion",
    name: "Expansion",
    boost: "culture",
    flaw: "stability",
    freeBoost: true,
    grantedSkill: "exploration",
    description:
      "Your patron places you in charge of a domain adjacent to settled lands. Greater support bolsters your society, but reliance on your ally can impede your security.",
  },
  {
    id: "exploration",
    name: "Exploration",
    boost: "stability",
    flaw: "economy",
    freeBoost: true,
    grantedSkill: "wilderness",
    description:
      "Your sponsor wants you to explore, clear, and settle a wilderness. Your charter secures initial structures at the cost of financial debt.",
  },
  {
    id: "grant",
    name: "Grant",
    boost: "economy",
    flaw: "loyalty",
    freeBoost: true,
    grantedSkill: "industry",
    description:
      "Your patron grants funding and resources with no restriction, but requires you to employ many of their citizens, splitting some residents' allegiance.",
  },
  {
    id: "open",
    name: "Open",
    boost: null,
    flaw: null,
    freeBoost: true,
    grantedSkill: null,
    description:
      "You stake your own claim with no restrictions and no direct support. A single free ability boost and no built-in flaw.",
  },
];

export function getCharter(id: string | null | undefined): CharterDef | undefined {
  return CHARTERS.find((c) => c.id === id);
}

// ──────────────────────────────────────────────
// Heartland (KPG 13)
// ──────────────────────────────────────────────

export interface HeartlandDef {
  id: string;
  name: string;
  boost: KingdomAbility;
  /** Terrain(s) this heartland represents — drives the Favored Land ability. */
  terrain: string[];
  /** VK only — the Kingdom skill this heartland trains. RAW grants none. */
  grantedSkill: string;
}

export const HEARTLANDS: HeartlandDef[] = [
  { id: "forest_swamp", name: "Forest or Swamp", boost: "culture", terrain: ["forest", "swamp"], grantedSkill: "wilderness" },
  { id: "hill_plain", name: "Hill or Plain", boost: "loyalty", terrain: ["hills", "plains"], grantedSkill: "agriculture" },
  { id: "lake_river", name: "Lake or River", boost: "economy", terrain: ["lake", "river"], grantedSkill: "boating" },
  { id: "mountain_ruins", name: "Mountain or Ruins", boost: "stability", terrain: ["mountains", "ruins"], grantedSkill: "defense" },
];

export function getHeartland(id: string | null | undefined): HeartlandDef | undefined {
  return HEARTLANDS.find((h) => h.id === id);
}

// ──────────────────────────────────────────────
// Government (KPG 13-14)
// ──────────────────────────────────────────────

export interface GovernmentDef {
  id: string;
  name: string;
  /** Two fixed ability boosts. */
  boosts: [KingdomAbility, KingdomAbility];
  /** Plus one free boost (to an ability other than the two above). */
  freeBoost: true;
  /** Two Kingdom skills gained at trained. */
  skills: [string, string];
  bonusFeat: string;
  description: string;
}

export const GOVERNMENTS: GovernmentDef[] = [
  {
    id: "despotism",
    name: "Despotism",
    boosts: ["stability", "economy"],
    freeBoost: true,
    skills: ["intrigue", "warfare"],
    bonusFeat: "Crush Dissent",
    description: "Rule centered on a single individual whose authority is absolute.",
  },
  {
    id: "feudalism",
    name: "Feudalism",
    boosts: ["stability", "culture"],
    freeBoost: true,
    skills: ["defense", "trade"],
    bonusFeat: "Fortified Fiefs",
    description: "Rule vested in a dynastic royal family; power distributed among vassals.",
  },
  {
    id: "oligarchy",
    name: "Oligarchy",
    boosts: ["loyalty", "economy"],
    freeBoost: true,
    skills: ["arts", "industry"],
    bonusFeat: "Insider Trading",
    description: "Rule by a council of influential leaders who decide for all others.",
  },
  {
    id: "republic",
    name: "Republic",
    boosts: ["stability", "loyalty"],
    freeBoost: true,
    skills: ["engineering", "politics"],
    bonusFeat: "Pull Together",
    description: "Leadership drawn from citizens; elected representatives meet in parliament.",
  },
  {
    id: "thaumocracy",
    name: "Thaumocracy",
    boosts: ["economy", "culture"],
    freeBoost: true,
    skills: ["folklore", "magic"],
    bonusFeat: "Practical Magic",
    description: "Governed by those most skilled in magic, arcane, divine, occult, or primal.",
  },
  {
    id: "yeomanry",
    name: "Yeomanry",
    boosts: ["loyalty", "culture"],
    freeBoost: true,
    skills: ["agriculture", "wilderness"],
    bonusFeat: "Muddle Through",
    description: "Decentralized rule relying on local leaders and citizens.",
  },
];

export function getGovernment(id: string | null | undefined): GovernmentDef | undefined {
  return GOVERNMENTS.find((g) => g.id === id);
}

// ──────────────────────────────────────────────
// Kingdom skills (KPG 20-21)
// ──────────────────────────────────────────────

export interface KingdomSkillDef {
  id: string;
  name: string;
  keyAbility: KingdomAbility;
}

/** The 16 Kingdom skills, 4 per ability. */
export const KINGDOM_SKILLS: KingdomSkillDef[] = [
  { id: "agriculture", name: "Agriculture", keyAbility: "stability" },
  { id: "arts", name: "Arts", keyAbility: "culture" },
  { id: "boating", name: "Boating", keyAbility: "economy" },
  { id: "defense", name: "Defense", keyAbility: "stability" },
  { id: "engineering", name: "Engineering", keyAbility: "stability" },
  { id: "exploration", name: "Exploration", keyAbility: "economy" },
  { id: "folklore", name: "Folklore", keyAbility: "culture" },
  { id: "industry", name: "Industry", keyAbility: "economy" },
  { id: "intrigue", name: "Intrigue", keyAbility: "loyalty" },
  { id: "magic", name: "Magic", keyAbility: "culture" },
  { id: "politics", name: "Politics", keyAbility: "loyalty" },
  { id: "scholarship", name: "Scholarship", keyAbility: "culture" },
  { id: "statecraft", name: "Statecraft", keyAbility: "loyalty" },
  { id: "trade", name: "Trade", keyAbility: "economy" },
  { id: "warfare", name: "Warfare", keyAbility: "loyalty" },
  { id: "wilderness", name: "Wilderness", keyAbility: "stability" },
];

export function getKingdomSkill(id: string): KingdomSkillDef | undefined {
  return KINGDOM_SKILLS.find((s) => s.id === id);
}

// ──────────────────────────────────────────────
// Proficiency (KPG 20)
// ──────────────────────────────────────────────

/** 0 untrained · 1 trained · 2 expert · 3 master · 4 legendary */
export type ProficiencyRank = 0 | 1 | 2 | 3 | 4;

export const PROFICIENCY_LABELS: Record<ProficiencyRank, string> = {
  0: "Untrained",
  1: "Trained",
  2: "Expert",
  3: "Master",
  4: "Legendary",
};

export type UntrainedImprovisation = "none" | "half" | "full";

/**
 * Proficiency bonus for a Kingdom skill check.
 *
 * Untrained is +0 unless the kingdom has Untrained Improvisation (a VK feature
 * gained at level 2, upgrading to the full bonus at level 7):
 *  - "half" → floor(level / 2)
 *  - "full" → level
 * Trained and better is `level + 2 × rank` (trained +2, expert +4, master +6,
 * legendary +8, each added to the kingdom's level).
 */
export function proficiencyBonus(
  rank: ProficiencyRank,
  level: number,
  untrainedImprovisation: UntrainedImprovisation = "none",
): number {
  if (rank === 0) {
    if (untrainedImprovisation === "full") return level;
    if (untrainedImprovisation === "half") return Math.floor(level / 2);
    return 0;
  }
  return level + 2 * rank;
}

/**
 * Untrained Improvisation state for a kingdom, given its ruleset and level.
 * RAW kingdoms never get it; VK kingdoms get the half bonus at 2 and full at 7.
 */
export function untrainedImprovisation(
  ruleset: KingdomRuleset,
  level: number,
): UntrainedImprovisation {
  if (ruleset !== "VK") return "none";
  if (level >= 7) return "full";
  if (level >= 2) return "half";
  return "none";
}

// ──────────────────────────────────────────────
// Skill modifier (KPG 21)
// ──────────────────────────────────────────────

export interface SkillModifierInput {
  keyAbilityScore: number;
  rank: ProficiencyRank;
  level: number;
  untrainedImprovisation?: UntrainedImprovisation;
  /** Status bonus — invested leadership roles, Kingdom feats, long-term events. */
  statusBonus?: number;
  /** Item bonus — settlement structures. */
  itemBonus?: number;
  /** Circumstance bonus — activities, level-based abilities. */
  circumstanceBonus?: number;
  /** Item penalty from Ruin (positive number, subtracted). */
  ruinPenalty?: number;
  /** Vacancy penalty (positive number, subtracted). */
  vacancyPenalty?: number;
  /** Any other flat penalty (positive number, subtracted). */
  otherPenalty?: number;
}

export interface SkillModifierBreakdown {
  abilityMod: number;
  proficiencyBonus: number;
  statusBonus: number;
  itemBonus: number;
  circumstanceBonus: number;
  ruinPenalty: number;
  vacancyPenalty: number;
  otherPenalty: number;
  total: number;
}

/**
 * Full skill modifier breakdown for a Kingdom skill check.
 *
 *   modifier = key ability modifier + proficiency bonus + bonuses − penalties
 *
 * Bonus stacking (different types stack, same type takes the highest) is the
 * caller's responsibility; pass the already-resolved value for each type.
 */
export function skillModifier(input: SkillModifierInput): SkillModifierBreakdown {
  const abilityMod = abilityModifier(input.keyAbilityScore);
  const profBonus = proficiencyBonus(
    input.rank,
    input.level,
    input.untrainedImprovisation ?? "none",
  );
  const statusBonus = input.statusBonus ?? 0;
  const itemBonus = input.itemBonus ?? 0;
  const circumstanceBonus = input.circumstanceBonus ?? 0;
  const ruinPenalty = input.ruinPenalty ?? 0;
  const vacancyPenalty = input.vacancyPenalty ?? 0;
  const otherPenalty = input.otherPenalty ?? 0;

  const total =
    abilityMod +
    profBonus +
    statusBonus +
    itemBonus +
    circumstanceBonus -
    ruinPenalty -
    vacancyPenalty -
    otherPenalty;

  return {
    abilityMod,
    proficiencyBonus: profBonus,
    statusBonus,
    itemBonus,
    circumstanceBonus,
    ruinPenalty,
    vacancyPenalty,
    otherPenalty,
    total,
  };
}

// ──────────────────────────────────────────────
// Leadership roles (KPG 18-19)
// ──────────────────────────────────────────────

export interface LeadershipRoleDef {
  id: string;
  name: string;
  keyAbility: KingdomAbility;
  vacancyPenalty: string;
  description: string;
}

export const LEADERSHIP_ROLES: LeadershipRoleDef[] = [
  {
    id: "ruler",
    name: "Ruler",
    keyAbility: "loyalty",
    vacancyPenalty:
      "−1 to all kingdom checks (stacks with other vacancy penalties); gain 1d4 Unrest at the start of the Kingdom turn; Control DC increases by 2.",
    description:
      "Performs the kingdom's most important ceremonies, is its chief diplomat, signs all laws, and appoints other leaders.",
  },
  {
    id: "counselor",
    name: "Counselor",
    keyAbility: "culture",
    vacancyPenalty: "−1 to all Culture-based checks.",
    description:
      "Liaison between government and citizens; interprets the desires of the people and advises the other leaders.",
  },
  {
    id: "general",
    name: "General",
    keyAbility: "stability",
    vacancyPenalty: "−4 to Warfare activities.",
    description:
      "Leads the kingdom's military, its armies, and its subordinate commanders, in war and in peace.",
  },
  {
    id: "emissary",
    name: "Emissary",
    keyAbility: "loyalty",
    vacancyPenalty: "−1 to all Loyalty-based checks.",
    description:
      "Keeps state secrets, oversees clandestine intrigues, handles criminal elements, and manages foreign policy.",
  },
  {
    id: "magister",
    name: "Magister",
    keyAbility: "culture",
    vacancyPenalty: "−4 to Warfare activities.",
    description:
      "In charge of all things magical, promoting higher learning in the arcane, divine, occult, and primal arts.",
  },
  {
    id: "treasurer",
    name: "Treasurer",
    keyAbility: "economy",
    vacancyPenalty: "−1 to all Economy-based checks.",
    description:
      "Monitors the kingdom's funds, the state of industry, confidence in the economy, and taxation.",
  },
  {
    id: "viceroy",
    name: "Viceroy",
    keyAbility: "economy",
    vacancyPenalty: "−1 to Stability-based checks.",
    description:
      "Plans and implements the kingdom's expansion and development, its infrastructure and capital improvements.",
  },
  {
    id: "warden",
    name: "Warden",
    keyAbility: "stability",
    vacancyPenalty: "−4 to Region activities.",
    description:
      "Monitors the safety, security, and health of the kingdom, its lands, and its borders; manages scouts and patrols.",
  },
];

export function getLeadershipRole(id: string): LeadershipRoleDef | undefined {
  return LEADERSHIP_ROLES.find((r) => r.id === id);
}

/**
 * Status bonus to a skill from invested leadership roles.
 *
 * Each invested role grants +1 to checks using its key ability's skills. Status
 * bonuses of the same type do not stack, so multiple invested roles keyed to the
 * same ability still only yield +1 (RAW). VK additionally allows Kingdom-feat
 * status bonuses to stack with role bonuses, but that is applied by the caller.
 */
export function investedStatusBonus(
  skillKeyAbility: KingdomAbility,
  investedRoleIds: string[],
): number {
  const anyInvestedForAbility = investedRoleIds.some(
    (id) => getLeadershipRole(id)?.keyAbility === skillKeyAbility,
  );
  return anyInvestedForAbility ? 1 : 0;
}

/**
 * Penalty from leadership roles nobody is filling (KPG 18-19).
 *
 * A role is *vacant* when no character and no NPC holds it — which is separate
 * from whether it is invested; investment is what grants the +1 status bonus,
 * vacancy is what levies these penalties.
 *
 * Vacancy penalties are untyped, so every applicable one stacks (the Ruler's
 * entry says so explicitly). Which ones apply depends on both the skill's key
 * ability and the traits of the activity being attempted:
 *
 *   Ruler      −1 to every kingdom check (and +2 Control DC, see `controlDC`)
 *   Counselor  −1 to Culture-based checks
 *   Emissary   −1 to Loyalty-based checks
 *   Treasurer  −1 to Economy-based checks
 *   Viceroy    −1 to Stability-based checks (note: its own key ability is Economy)
 *   General    −4 to Warfare activities
 *   Magister   −4 to Warfare activities
 *   Warden     −4 to Region activities
 *
 * This catalogue tags warfare activities with the ARMY trait, so that is what
 * the −4 warfare penalties key off.
 */
const VACANCY_RULES: Record<
  string,
  { amount: number; reason: string; applies: (keyAbility: KingdomAbility, traits: string[]) => boolean }
> = {
  ruler: { amount: 1, reason: "all kingdom checks", applies: () => true },
  counselor: { amount: 1, reason: "Culture-based checks", applies: (a) => a === "culture" },
  emissary: { amount: 1, reason: "Loyalty-based checks", applies: (a) => a === "loyalty" },
  treasurer: { amount: 1, reason: "Economy-based checks", applies: (a) => a === "economy" },
  viceroy: { amount: 1, reason: "Stability-based checks", applies: (a) => a === "stability" },
  general: { amount: 4, reason: "Warfare activities", applies: (_a, t) => t.includes("ARMY") },
  magister: { amount: 4, reason: "Warfare activities", applies: (_a, t) => t.includes("ARMY") },
  warden: { amount: 4, reason: "Region activities", applies: (_a, t) => t.includes("REGION") },
};

export interface VacancyPenaltySource {
  roleId: string;
  roleName: string;
  amount: number;
  reason: string;
}

export interface VacancyPenaltyResult {
  /** Positive number, to be subtracted from the check. */
  total: number;
  sources: VacancyPenaltySource[];
}

/**
 * Total vacancy penalty against one check, with the per-role breakdown so the
 * UI can explain where a modifier came from.
 */
export function vacancyPenalty(
  vacantRoleIds: string[],
  skillKeyAbility: KingdomAbility,
  activityTraits: string[] = [],
): VacancyPenaltyResult {
  const sources: VacancyPenaltySource[] = [];
  for (const roleId of vacantRoleIds) {
    const rule = VACANCY_RULES[roleId];
    if (!rule || !rule.applies(skillKeyAbility, activityTraits)) continue;
    sources.push({
      roleId,
      roleName: getLeadershipRole(roleId)?.name ?? roleId,
      amount: rule.amount,
      reason: rule.reason,
    });
  }
  return { total: sources.reduce((sum, s) => sum + s.amount, 0), sources };
}

// ──────────────────────────────────────────────
// Kingdom Size (KPG 37-38)
// ──────────────────────────────────────────────

export interface SizeBracket {
  minSize: number;
  maxSize: number | null;
  nation: string;
  /** Die faces: 4 = d4, 6 = d6, etc. */
  resourceDie: number;
  controlDCModifier: number;
  commodityStorage: number;
}

export const SIZE_TABLE: SizeBracket[] = [
  { minSize: 1, maxSize: 9, nation: "Territory", resourceDie: 4, controlDCModifier: 0, commodityStorage: 4 },
  { minSize: 10, maxSize: 24, nation: "Province", resourceDie: 6, controlDCModifier: 1, commodityStorage: 8 },
  { minSize: 25, maxSize: 49, nation: "State", resourceDie: 8, controlDCModifier: 2, commodityStorage: 12 },
  { minSize: 50, maxSize: 99, nation: "Country", resourceDie: 10, controlDCModifier: 3, commodityStorage: 16 },
  { minSize: 100, maxSize: null, nation: "Dominion", resourceDie: 12, controlDCModifier: 4, commodityStorage: 20 },
];

export function sizeBracket(size: number): SizeBracket {
  const s = Math.max(1, Math.floor(size));
  return (
    SIZE_TABLE.find((b) => s >= b.minSize && (b.maxSize === null || s <= b.maxSize)) ??
    SIZE_TABLE[SIZE_TABLE.length - 1]
  );
}

// ──────────────────────────────────────────────
// Control DC & advancement (KPG 16)
// ──────────────────────────────────────────────

/** Base Control DC by kingdom level (1–20), before the Size modifier. */
export const CONTROL_DC_BY_LEVEL: Record<number, number> = {
  1: 14, 2: 15, 3: 16, 4: 18, 5: 20, 6: 22, 7: 23, 8: 24, 9: 26, 10: 27,
  11: 28, 12: 30, 13: 31, 14: 32, 15: 34, 16: 35, 17: 36, 18: 38, 19: 39, 20: 40,
};

export function clampLevel(level: number): number {
  return Math.max(1, Math.min(20, Math.floor(level)));
}

/**
 * Control DC = base for level + Size modifier, +2 while the Ruler seat is
 * vacant (KPG 19 — the one vacancy penalty that raises the DC instead of
 * lowering the modifier).
 */
export function controlDC(level: number, size = 1, rulerVacant = false): number {
  return (
    CONTROL_DC_BY_LEVEL[clampLevel(level)] +
    sizeBracket(size).controlDCModifier +
    (rulerVacant ? 2 : 0)
  );
}

/** Number of Resource Dice rolled at the start of a Kingdom turn. */
export function resourceDiceCount(level: number, carryoverBonusDice = 0): number {
  return Math.max(0, clampLevel(level) + 4 + carryoverBonusDice);
}

// ──────────────────────────────────────────────
// Ruin (KPG 38)
// ──────────────────────────────────────────────

export interface RuinDef {
  id: string;
  name: string;
  /** The ability whose checks a Ruin penalty afflicts. */
  ability: KingdomAbility;
}

export const RUINS: RuinDef[] = [
  { id: "corruption", name: "Corruption", ability: "culture" },
  { id: "crime", name: "Crime", ability: "economy" },
  { id: "decay", name: "Decay", ability: "stability" },
  { id: "strife", name: "Strife", ability: "loyalty" },
];

export const RUIN_BASE_THRESHOLD = 10;

/**
 * Resolve Ruin points crossing a threshold: while points ≥ threshold, subtract
 * the threshold and add 1 to the penalty. Returns the settled points + penalty.
 */
export function resolveRuin(
  points: number,
  threshold: number,
  penalty: number,
): { points: number; penalty: number } {
  let p = Math.max(0, points);
  let pen = Math.max(0, penalty);
  const t = Math.max(1, threshold);
  while (p >= t) {
    p -= t;
    pen += 1;
  }
  return { points: p, penalty: pen };
}

// ──────────────────────────────────────────────
// Commodities & anarchy thresholds
// ──────────────────────────────────────────────

export const COMMODITIES = ["food", "lumber", "luxuries", "ore", "stone"] as const;
export type Commodity = (typeof COMMODITIES)[number];

export const COMMODITY_LABELS: Record<Commodity, string> = {
  food: "Food",
  lumber: "Lumber",
  luxuries: "Luxuries",
  ore: "Ore",
  stone: "Stone",
};

/** Unrest ≥ this value tips the kingdom into anarchy. */
export const ANARCHY_UNREST = 20;
/** Unrest ≥ this value causes 1d10 Ruin during the Upkeep phase. */
export const UNREST_RUIN_THRESHOLD = 10;

/** Unrest thresholds and their status penalty to every kingdom check (KPG 39). */
const UNREST_PENALTY_TIERS: [threshold: number, penalty: number][] = [
  [15, 4],
  [10, 3],
  [5, 2],
  [1, 1],
];

/** The status penalty Unrest applies to every kingdom skill check right now. */
export function unrestStatusPenalty(unrest: number): number {
  return UNREST_PENALTY_TIERS.find(([threshold]) => unrest >= threshold)?.[1] ?? 0;
}

export const FAME_MAX_DEFAULT = 3;

// ──────────────────────────────────────────────
// Settlements (KPG 46-47)
// ──────────────────────────────────────────────

export interface SettlementTypeDef {
  id: string;
  name: string;
  minKingdomLevel: number;
  maxBlocks: number;
  baseConsumption: number;
  maxItemBonus: number;
  /** Influence radius, in hexes. */
  influence: number;
}

export const SETTLEMENT_TYPES: SettlementTypeDef[] = [
  { id: "village", name: "Village", minKingdomLevel: 1, maxBlocks: 1, baseConsumption: 1, maxItemBonus: 1, influence: 0 },
  { id: "town", name: "Town", minKingdomLevel: 3, maxBlocks: 4, baseConsumption: 2, maxItemBonus: 1, influence: 1 },
  { id: "city", name: "City", minKingdomLevel: 9, maxBlocks: 9, baseConsumption: 4, maxItemBonus: 2, influence: 2 },
  { id: "metropolis", name: "Metropolis", minKingdomLevel: 15, maxBlocks: 10, baseConsumption: 6, maxItemBonus: 3, influence: 3 },
];

export function getSettlementType(id: string): SettlementTypeDef | undefined {
  return SETTLEMENT_TYPES.find((t) => t.id === id);
}

// ──────────────────────────────────────────────
// Kingdom advancement tables (KPG 16 / VK)
// ──────────────────────────────────────────────

export interface LevelFeatures {
  level: number;
  controlDC: number;
  /** Gains a Kingdom feat this level. */
  kingdomFeat: boolean;
  /** Gains a skill increase this level. */
  skillIncrease: boolean;
  /** Number of ability boosts gained this level (0, 2, or 3). */
  abilityBoosts: number;
  /** Named milestone features gained this level. */
  features: string[];
}

const RAW_FEATURES: Record<number, string[]> = {
  1: ["Charter", "Government", "Heartland", "Initial proficiencies", "Favored land", "Settlement construction (village)"],
  2: ["Kingdom feat"],
  3: ["Settlement construction (town)", "Skill increase"],
  4: ["Expansion expert", "Fine living", "Kingdom feat"],
  5: ["Ability boosts", "Ruin resistance", "Skill increase"],
  6: ["Kingdom feat"],
  7: ["Skill increase"],
  8: ["Experienced leadership +2", "Kingdom feat", "Ruin resistance"],
  9: ["Expansion expert (Claim Hex 3×/turn)", "Settlement construction (city)", "Skill increase"],
  10: ["Ability boosts", "Kingdom feat", "Life of luxury"],
  11: ["Ruin resistance", "Skill increase"],
  12: ["Civic planning", "Kingdom feat"],
  13: ["Skill increase"],
  14: ["Kingdom feat", "Ruin resistance"],
  15: ["Ability boosts", "Settlement construction (metropolis)", "Skill increase"],
  16: ["Experienced leadership +3", "Kingdom feat"],
  17: ["Ruin resistance", "Skill increase"],
  18: ["Kingdom feat"],
  19: ["Skill increase"],
  20: ["Ability boosts", "Envy of the world", "Kingdom feat", "Ruin resistance"],
};

const VK_FEATURES: Record<number, string[]> = {
  1: ["Charter", "Government", "Heartland", "Initial proficiencies", "Favored land", "Settlement construction (village)"],
  2: ["Kingdom feat", "Skill increase", "Untrained Improvisation"],
  3: ["Settlement construction (town)", "Skill increase"],
  4: ["Expansion expert", "Fine living", "Kingdom feat", "Skill increase"],
  5: ["Ability boosts", "Ruin resistance", "Skill increase"],
  6: ["Kingdom feat", "Skill increase"],
  7: ["Skill increase", "Untrained Improvisation (full)"],
  8: ["Experienced leadership +2", "Kingdom feat", "Ruin resistance", "Skill increase"],
  9: ["Expansion expert (Claim Hex 3×/turn)", "Settlement construction (city)", "Skill increase"],
  10: ["Ability boosts", "Kingdom feat", "Life of luxury", "Skill increase"],
  11: ["Ruin resistance", "Skill increase"],
  12: ["Civic planning", "Kingdom feat", "Skill increase"],
  13: ["Skill increase"],
  14: ["Kingdom feat", "Ruin resistance", "Skill increase"],
  15: ["Ability boosts", "Settlement construction (metropolis)", "Skill increase"],
  16: ["Experienced leadership +3", "Kingdom feat", "Skill increase"],
  17: ["Ruin resistance", "Skill increase"],
  18: ["Kingdom feat", "Skill increase"],
  19: ["Skill increase"],
  20: ["Ability boosts", "Envy of the world", "Kingdom feat", "Ruin resistance", "Skill increase"],
};

/** Full 1–20 advancement table for a ruleset. */
export function advancementTable(ruleset: KingdomRuleset): LevelFeatures[] {
  const source = ruleset === "VK" ? VK_FEATURES : RAW_FEATURES;
  const boostLevels = new Set([5, 10, 15, 20]);
  const boostCount = ruleset === "VK" ? 3 : 2;

  return Array.from({ length: 20 }, (_, i) => {
    const level = i + 1;
    const features = source[level] ?? [];
    return {
      level,
      controlDC: CONTROL_DC_BY_LEVEL[level],
      kingdomFeat: features.includes("Kingdom feat"),
      skillIncrease: features.includes("Skill increase"),
      abilityBoosts: boostLevels.has(level) ? boostCount : 0,
      features,
    };
  });
}

export function levelFeatures(ruleset: KingdomRuleset, level: number): LevelFeatures {
  return advancementTable(ruleset)[clampLevel(level) - 1];
}

/**
 * Free ability boosts chosen when finalizing scores at kingdom creation
 * (Step 5). RAW: 2. VK: 3.
 */
export function finalizeBoostCount(ruleset: KingdomRuleset): number {
  return ruleset === "VK" ? 3 : 2;
}

// ──────────────────────────────────────────────
// Ability score computation from founding choices
// ──────────────────────────────────────────────

export interface FoundingChoices {
  charter?: string | null;
  charterFreeBoost?: KingdomAbility | null;
  heartland?: string | null;
  government?: string | null;
  governmentFreeBoost?: KingdomAbility | null;
  /** Abilities chosen at Step 5 (length should equal finalizeBoostCount). */
  finalizeBoosts?: KingdomAbility[];
}

export interface AbilityScoreResult {
  scores: Record<KingdomAbility, number>;
  modifiers: Record<KingdomAbility, number>;
  /** Per-ability boost/flaw ledger, for showing the player the math. */
  ledger: Record<KingdomAbility, string[]>;
}

/**
 * Compute a kingdom's starting ability scores from its founding choices,
 * following Steps 2–5 of Kingdom Creation. Unknown / incomplete choices are
 * simply skipped, so this is safe to call on a half-built kingdom.
 */
export function computeAbilityScores(choices: FoundingChoices): AbilityScoreResult {
  const scores: Record<KingdomAbility, number> = {
    culture: 10,
    economy: 10,
    loyalty: 10,
    stability: 10,
  };
  const ledger: Record<KingdomAbility, string[]> = {
    culture: [],
    economy: [],
    loyalty: [],
    stability: [],
  };

  const boost = (ability: KingdomAbility | null | undefined, label: string) => {
    if (!ability) return;
    scores[ability] = applyBoost(scores[ability]);
    ledger[ability].push(`+ ${label}`);
  };
  const flaw = (ability: KingdomAbility | null | undefined, label: string) => {
    if (!ability) return;
    scores[ability] = applyFlaw(scores[ability]);
    ledger[ability].push(`− ${label}`);
  };

  const charter = getCharter(choices.charter);
  if (charter) {
    boost(charter.boost, "Charter");
    flaw(charter.flaw, "Charter flaw");
    boost(choices.charterFreeBoost, "Charter (free)");
  }

  const heartland = getHeartland(choices.heartland);
  if (heartland) boost(heartland.boost, "Heartland");

  const government = getGovernment(choices.government);
  if (government) {
    boost(government.boosts[0], "Government");
    boost(government.boosts[1], "Government");
    boost(choices.governmentFreeBoost, "Government (free)");
  }

  for (const ability of choices.finalizeBoosts ?? []) {
    boost(ability, "Finalize");
  }

  const modifiers: Record<KingdomAbility, number> = {
    culture: abilityModifier(scores.culture),
    economy: abilityModifier(scores.economy),
    loyalty: abilityModifier(scores.loyalty),
    stability: abilityModifier(scores.stability),
  };

  return { scores, modifiers, ledger };
}

// ──────────────────────────────────────────────
// Starting trained skills
// ──────────────────────────────────────────────

/**
 * Where a starting trained skill came from. Used to explain the roster in the
 * founding wizard rather than presenting an unsourced list.
 */
export type SkillSource = "charter" | "heartland" | "government";

export interface StartingSkillsInput {
  ruleset: KingdomRuleset;
  charter?: string | null;
  heartland?: string | null;
  government?: string | null;
  /** Skills the player chose for the free slots, in any order. */
  picks?: string[];
}

export interface StartingSkillsResult {
  /** Skills trained automatically, with the choice responsible for each. */
  granted: { skill: string; source: SkillSource }[];
  /** How many skills the player chooses freely, after duplicates are folded in. */
  freePicks: number;
  /** Valid picks, in input order, capped at `freePicks`. */
  picks: string[];
  /** Every skill the kingdom starts trained in. */
  trained: string[];
  /** Picks that were unknown, already trained, or beyond the allowance. */
  rejected: string[];
  /** Free slots still waiting on a choice. */
  remaining: number;
}

/**
 * Resolve a kingdom's starting trained skills from its founding choices.
 *
 * RAW trains only the government's two skills. VK additionally trains one skill
 * from the charter and one from the heartland, and grants a free pick alongside
 * each of those. A granted skill the kingdom is already trained in converts to
 * another free pick, per the V&K text.
 */
export function startingSkills(input: StartingSkillsInput): StartingSkillsResult {
  const granted: { skill: string; source: SkillSource }[] = [];
  const trained = new Set<string>();
  let freePicks = 0;

  const grant = (skill: string | null | undefined, source: SkillSource) => {
    // A null grant is a "choose any" slot; a duplicate becomes one too.
    if (!skill || trained.has(skill)) {
      freePicks += 1;
      return;
    }
    trained.add(skill);
    granted.push({ skill, source });
  };

  const government = getGovernment(input.government);
  if (government) {
    grant(government.skills[0], "government");
    grant(government.skills[1], "government");
  }

  if (input.ruleset === "VK") {
    const charter = getCharter(input.charter);
    if (charter) {
      grant(charter.grantedSkill, "charter");
      freePicks += 1; // the charter's free skill
    }
    const heartland = getHeartland(input.heartland);
    if (heartland) {
      grant(heartland.grantedSkill, "heartland");
      freePicks += 1; // the heartland's free skill
    }
  }

  const picks: string[] = [];
  const rejected: string[] = [];
  for (const pick of input.picks ?? []) {
    if (picks.length >= freePicks || !getKingdomSkill(pick) || trained.has(pick)) {
      rejected.push(pick);
      continue;
    }
    trained.add(pick);
    picks.push(pick);
  }

  return {
    granted,
    freePicks,
    picks,
    trained: [...trained],
    rejected,
    remaining: freePicks - picks.length,
  };
}

// ──────────────────────────────────────────────
// Kingdom turn structure (KPG 42-44)
// ──────────────────────────────────────────────

export interface TurnStepDef {
  id: string;
  name: string;
  hint: string;
}

export interface TurnPhaseDef {
  id: string;
  name: string;
  steps: TurnStepDef[];
}

export const KINGDOM_TURN_PHASES: TurnPhaseDef[] = [
  {
    id: "upkeep",
    name: "Upkeep",
    steps: [
      { id: "assign-leadership", name: "Assign Leadership Roles", hint: "Re-select invested roles; apply vacancy penalties." },
      { id: "adjust-unrest", name: "Adjust Unrest", hint: "+1 per Overcrowded settlement, +1 if at war; 1d10 Ruin if Unrest ≥ 10." },
      { id: "resource-collection", name: "Resource Collection", hint: "Roll Resource Dice for RP; gather Commodities from Work Sites." },
      { id: "pay-consumption", name: "Pay Consumption", hint: "Spend Food equal to Consumption, or 5 RP / point, or +1d4 Unrest." },
    ],
  },
  {
    id: "commerce",
    name: "Commerce",
    steps: [
      { id: "collect-taxes", name: "Collect Taxes", hint: "Once per turn; or DC 11 flat check to reduce Unrest by 1." },
      { id: "approve-expenses", name: "Approve Expenses", hint: "Improve Lifestyle or Tap Treasury." },
      { id: "tap-commodities", name: "Tap Commodities", hint: "Trade Commodities to bolster RP." },
      { id: "manage-trade", name: "Manage Trade Agreements", hint: "If trade agreements are established." },
    ],
  },
  {
    id: "activity",
    name: "Activity",
    steps: [
      { id: "leadership-activities", name: "Leadership Activities", hint: "2 per leader, or 3 with a Castle / Palace / Town Hall in the capital." },
      { id: "region-activities", name: "Region Activities", hint: "Up to 3 collectively." },
      { id: "civic-activities", name: "Civic Activities", hint: "1 per settlement." },
      { id: "army-activities", name: "Army Activities", hint: "During wartime only." },
    ],
  },
  {
    id: "event",
    name: "Event",
    steps: [
      { id: "check-event", name: "Check for a Random Event", hint: "DC 16 flat check; DC drops by 5 each turn with no event (not tracked automatically)." },
      { id: "resolve-event", name: "Event Resolution", hint: "Resolve any triggered kingdom event." },
      { id: "milestone-check", name: "Milestone Check", hint: "This table levels the kingdom by milestone, not XP — review progress and bump the level on the Overview tab if it's earned." },
    ],
  },
];
