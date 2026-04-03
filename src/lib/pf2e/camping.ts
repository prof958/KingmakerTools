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
 * Standard camping activities from the Kingmaker AP.
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
    id: "cook-meal",
    name: "Cook Meal",
    description: "Prepare a meal for the party using a known recipe.",
    skill: "Survival / Cooking Lore",
    dc: null,
    isRequired: false,
  },
  {
    id: "hunt-and-gather",
    name: "Hunt and Gather",
    description: "Forage for food and ingredients in the surrounding area.",
    skill: "Survival",
    dc: null,
    isRequired: false,
  },
  {
    id: "camouflage-campsite",
    name: "Camouflage Campsite",
    description: "Hide the campsite to reduce the chance of random encounters.",
    skill: "Stealth / Survival",
    dc: null,
    isRequired: false,
  },
  {
    id: "blend-into-the-night",
    name: "Blend Into the Night",
    description: "Use stealth to avoid detection during the night.",
    skill: "Stealth",
    dc: null,
    isRequired: false,
  },
  {
    id: "organize-watch",
    name: "Organize Watch",
    description: "Coordinate the watch to improve its effectiveness.",
    skill: "Perception",
    dc: null,
    isRequired: false,
  },
  {
    id: "set-up-traps",
    name: "Set Up Traps",
    description: "Place defensive traps around the campsite perimeter.",
    skill: "Crafting / Survival",
    dc: null,
    isRequired: false,
  },
  {
    id: "tell-campfire-story",
    name: "Tell Campfire Story",
    description: "Boost morale with a rousing tale around the fire.",
    skill: "Performance",
    dc: null,
    isRequired: false,
  },
  {
    id: "discover-special-meal",
    name: "Discover Special Meal",
    description: "Experiment to discover a new recipe for the recipe book.",
    skill: "Survival / Cooking Lore",
    dc: null,
    isRequired: false,
  },
  {
    id: "learn-from-companion",
    name: "Learn from a Companion",
    description: "Interact with an NPC companion to gain insights or improve relations.",
    skill: "Diplomacy / Perception",
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
