/**
 * Zustand store for campsite canvas state.
 *
 * Manages element positions, selection, zoom/pan, and save state.
 * Canvas elements are typed and stored as a flat array.
 */
import { create } from "zustand";

// ───── Element Types ─────

export type ElementType = "tent" | "campfire" | "character" | "trap" | "bedroll" | "marker";

export interface CampElement {
  id: string;
  type: ElementType;
  label: string;
  x: number;
  y: number;
  rotation?: number;
  /** For character elements, links to character ID */
  characterId?: string;
}

// ───── Store State ─────

interface CampsiteCanvasState {
  // Layout metadata
  layoutId: string | null;
  layoutName: string;

  // Canvas elements
  elements: CampElement[];

  // Selection state
  selectedId: string | null;

  // Viewport
  stageX: number;
  stageY: number;
  scale: number;

  // Dirty tracking
  isDirty: boolean;
  isSaving: boolean;

  // Actions
  setLayout: (id: string, name: string, elements: CampElement[]) => void;
  addElement: (element: CampElement) => void;
  updateElement: (id: string, updates: Partial<CampElement>) => void;
  removeElement: (id: string) => void;
  select: (id: string | null) => void;
  setViewport: (x: number, y: number, scale: number) => void;
  markSaved: () => void;
  setSaving: (saving: boolean) => void;
  resetCanvas: () => void;
}

// ───── Element palette (icons & defaults) ─────

export const ELEMENT_PALETTE: {
  type: ElementType;
  label: string;
  emoji: string;
}[] = [
  { type: "tent", label: "Tent", emoji: "⛺" },
  { type: "campfire", label: "Campfire", emoji: "🔥" },
  { type: "bedroll", label: "Bedroll", emoji: "🛏️" },
  { type: "trap", label: "Trap", emoji: "⚠️" },
  { type: "marker", label: "Marker", emoji: "📍" },
];

// ───── Store ─────

export const useCampsiteStore = create<CampsiteCanvasState>((set) => ({
  layoutId: null,
  layoutName: "New Camp",
  elements: [],
  selectedId: null,
  stageX: 0,
  stageY: 0,
  scale: 1,
  isDirty: false,
  isSaving: false,

  setLayout: (id, name, elements) =>
    set({
      layoutId: id,
      layoutName: name,
      elements,
      selectedId: null,
      isDirty: false,
    }),

  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, element],
      isDirty: true,
    })),

  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el,
      ),
      isDirty: true,
    })),

  removeElement: (id) =>
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      isDirty: true,
    })),

  select: (id) => set({ selectedId: id }),

  setViewport: (stageX, stageY, scale) =>
    set({ stageX, stageY, scale }),

  markSaved: () => set({ isDirty: false }),

  setSaving: (isSaving) => set({ isSaving }),

  resetCanvas: () =>
    set({
      layoutId: null,
      layoutName: "New Camp",
      elements: [],
      selectedId: null,
      stageX: 0,
      stageY: 0,
      scale: 1,
      isDirty: false,
      isSaving: false,
    }),
}));
