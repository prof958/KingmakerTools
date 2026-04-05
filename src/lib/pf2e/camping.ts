/**
 * PF2e Kingmaker Camping Activities
 *
 * Each activity takes one camping slot, involves a skill check,
 * and produces effects based on the result.
 */

export interface CampingActivityDef {
  id: string;
  name: string;
  description: string;
  skill: string;
  dc: number | null; // null = variable DC
  isRequired: boolean;
}

export interface RecipeDef {
  name: string;
  ingredients: string;
  dc: number;
  effectsSuccess: string;
  effectsFail: string;
}

/**
 * Standard camping activities from the Kingmaker AP (AoN).
 * Companion-specific activities (Harrim, Linzi, Jubilost, etc.) are excluded;
 * players can add those as custom activities once learned via "Learn from a Companion".
 */
export const CAMPING_ACTIVITIES: CampingActivityDef[] = [
  {
    id: "prepare-campsite",
    name: "Prepare Campsite",
    description: "Set up the campsite for the night. Required before other activities.",
    skill: "Survival",
    dc: 15,
    isRequired: true,
  },
  {
    id: "camouflage-campsite",
    name: "Camouflage Campsite",
    description:
      "Conceal the camp from potential threats. Attempt a Stealth check against the Zone DC. Can only attempt once per camping session.",
    skill: "Stealth",
    dc: null,
    isRequired: false,
  },
  {
    id: "cook-basic-meal",
    name: "Cook Basic Meal",
    description:
      "Spend 2 hours preparing a basic meal. Expend 2 basic ingredients per serving plus 1 day's rations.",
    skill: "Survival / Cooking Lore",
    dc: null,
    isRequired: false,
  },
  {
    id: "cook-special-meal",
    name: "Cook Special Meal",
    description:
      "Spend 2 hours preparing a special meal from a known recipe. Expend required ingredients plus 1 day's rations per serving.",
    skill: "Survival / Cooking Lore",
    dc: null,
    isRequired: false,
  },
  {
    id: "discover-special-meal",
    name: "Discover Special Meal",
    description:
      "Spend 2 hours attempting to discover a special recipe. Expend twice the normal ingredients for 1 serving.",
    skill: "Cooking Lore",
    dc: null,
    isRequired: false,
  },
  {
    id: "hunt-and-gather",
    name: "Hunt and Gather",
    description:
      "Spend 2 hours gathering ingredients. Attempt a Survival check against the Zone DC.",
    skill: "Survival",
    dc: null,
    isRequired: false,
  },
  {
    id: "learn-from-companion",
    name: "Learn from a Companion",
    description:
      "Spend 2 hours with a companion to learn their special activity. Attempt a DC 20 Perception check. The companion must be Friendly.",
    skill: "Perception",
    dc: 20,
    isRequired: false,
  },
  {
    id: "organize-watch",
    name: "Organize Watch",
    description:
      "Spend 2 hours organizing the watch rotation. Attempt a Perception check against the Zone DC. Requires expert in Perception.",
    skill: "Perception",
    dc: null,
    isRequired: false,
  },
  {
    id: "provide-aid",
    name: "Provide Aid",
    description:
      "Spend 2 hours aiding another character's camping activity. Attempt a skill check (typically DC 20). Bonuses don't stack.",
    skill: "Variable",
    dc: 20,
    isRequired: false,
  },
  {
    id: "relax",
    name: "Relax",
    description:
      "Spend 2 hours relaxing. Gain a +1 circumstance bonus to the next camping activity check this session. Can Relax multiple times.",
    skill: "None",
    dc: null,
    isRequired: false,
  },
  {
    id: "tell-campfire-story",
    name: "Tell Campfire Story",
    description:
      "Spend 2 hours telling a rousing story. Attempt a Performance check against a DC set by your level.",
    skill: "Performance",
    dc: null,
    isRequired: false,
  },
];

/**
 * Result degrees for PF2e skill checks.
 */
export type CheckResult =
  | "critical_success"
  | "success"
  | "failure"
  | "critical_failure";

/**
 * Get activity definition by ID.
 */
export function getActivity(id: string): CampingActivityDef | undefined {
  return CAMPING_ACTIVITIES.find((a) => a.id === id);
}

/**
 * Get all non-required (optional) activities.
 */
export function getOptionalActivities(): CampingActivityDef[] {
  return CAMPING_ACTIVITIES.filter((a) => !a.isRequired);
}
