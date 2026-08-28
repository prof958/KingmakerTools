import type { KingdomAbility } from "@/lib/pf2e/kingdom";

export interface CharacterLite {
  id: string;
  name: string;
  emoji: string | null;
  isCompanion: boolean;
}

export interface KingdomSkillData {
  id: string;
  skill: string;
  rank: number;
}

export interface LeadershipRoleData {
  id: string;
  role: string;
  characterId: string | null;
  npcName: string | null;
  invested: boolean;
  character: CharacterLite | null;
}

export interface KingdomFeatData {
  id: string;
  name: string;
  takenAtLevel: number | null;
  isBonus: boolean;
  notes: string | null;
}

export interface HexData {
  id: string;
  sheet: number;
  q: number;
  r: number;
  terrain: string;
  state: "UNCLAIMED" | "RECONNOITERED" | "CLAIMED";
  reconnoitered: boolean;
  hasRoads: boolean;
  fortified: boolean;
  workSite: string | null;
  features: string[];
  label: string | null;
  notes: string | null;
}

export interface SettlementLite {
  id: string;
  name: string;
  type: string;
  isCapital: boolean;
  level: number;
}

export interface KingdomData {
  id: string;
  name: string;
  ruleset: "RAW" | "VK";
  level: number;
  size: number;
  fame: number;
  fameType: "FAME" | "INFAMY";
  fameMax: number;
  atWar: boolean;

  charter: string | null;
  charterFreeBoost: string | null;
  heartland: string | null;
  government: string | null;
  governmentFreeBoost: string | null;
  finalizeBoosts: string[];
  skillPicks: string[];
  founded: boolean;

  culture: number;
  economy: number;
  loyalty: number;
  stability: number;

  unrest: number;

  corruptionPoints: number;
  corruptionThreshold: number;
  corruptionPenalty: number;
  crimePoints: number;
  crimeThreshold: number;
  crimePenalty: number;
  decayPoints: number;
  decayThreshold: number;
  decayPenalty: number;
  strifePoints: number;
  strifeThreshold: number;
  strifePenalty: number;

  rp: number;
  resourceDiceBonus: number;
  food: number;
  lumber: number;
  luxuries: number;
  ore: number;
  stone: number;

  currentTurn: number;
  notes: string | null;

  skills: KingdomSkillData[];
  feats: KingdomFeatData[];
  leadershipRoles: LeadershipRoleData[];
  settlements: SettlementLite[];
}

export const ABILITY_KEYS: KingdomAbility[] = ["culture", "economy", "loyalty", "stability"];
