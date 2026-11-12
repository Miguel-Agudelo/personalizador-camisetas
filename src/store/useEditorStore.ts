import { create } from 'zustand';
import type { Side } from '../config/shirt';
import { DEFAULT_REALISM, type RealismSettings } from '../engine/realismPipeline';
import { revokeUnusedObjectUrls } from '../utils/objectUrls';

export interface Design {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  flipX: boolean;
  flipY: boolean;
}

type DesignsBySide = Record<Side, Design[]>;
interface Snapshot {
  designs: DesignsBySide;
  selectedDesignId: string | null;
}

interface EditorState extends Snapshot {
  color: string;
  activeSide: Side;
  realism: RealismSettings;
  past: Snapshot[];
  future: Snapshot[];
  setColor: (color: string) => void;
  setActiveSide: (side: Side) => void;
  setRealism: (patch: Partial<RealismSettings>) => void;
  resetRealism: () => void;
  selectDesign: (id: string | null) => void;
  addDesign: (side: Side, design: Design) => void;
  updateDesign: (id: string, patch: Partial<Design>) => void;
  toggleLock: (id: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  moveLayer: (id: string, direction: -1 | 1) => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 30;

function copyDesigns(designs: DesignsBySide): DesignsBySide {
  return {
    front: designs.front.map((design) => ({ ...design })),
    back: designs.back.map((design) => ({ ...design })),
  };
}

function snapshot(state: Snapshot): Snapshot {
  return { designs: copyDesigns(state.designs), selectedDesignId: state.selectedDesignId };
}

function collectUrls(snapshots: Snapshot[]): Set<string> {
  const urls = new Set<string>();
  for (const entry of snapshots) {
    for (const side of ['front', 'back'] as const) {
      for (const design of entry.designs[side]) {
        if (design.src.startsWith('blob:')) urls.add(design.src);
      }
    }
  }
  return urls;
}

function withHistory(state: EditorState, designs: DesignsBySide, selectedDesignId: string | null): Partial<EditorState> {
  const past = [...state.past, snapshot(state)].slice(-HISTORY_LIMIT);
  const next = { designs, selectedDesignId, past, future: [] };
  revokeUnusedObjectUrls(collectUrls([next, ...past]));
  return next;
}

function selectedDesign(state: EditorState): Design | undefined {
  return state.designs[state.activeSide].find((design) => design.id === state.selectedDesignId);
}

export const useEditorStore = create<EditorState>((set) => ({
  color: '#F4F3EF',
  activeSide: 'front',
  realism: { ...DEFAULT_REALISM },
  designs: { front: [], back: [] },
  selectedDesignId: null,
  past: [],
  future: [],
  setColor: (color) => set({ color }),
  setActiveSide: (activeSide) => set({ activeSide, selectedDesignId: null }),
  setRealism: (patch) => set((state) => ({ realism: { ...state.realism, ...patch } })),
  resetRealism: () => set({ realism: { ...DEFAULT_REALISM } }),
  selectDesign: (selectedDesignId) => set({ selectedDesignId }),
  addDesign: (side, design) => set((state) => {
    const designs = copyDesigns(state.designs);
    designs[side] = [...designs[side], design];
    return { ...withHistory(state, designs, design.id), activeSide: side };
  }),
  updateDesign: (id, patch) => set((state) => {
    const original = state.designs[state.activeSide].find((design) => design.id === id);
    if (!original || original.locked) return state;
    const designs = copyDesigns(state.designs);
    designs[state.activeSide] = designs[state.activeSide].map((design) => design.id === id ? { ...design, ...patch } : design);
    return withHistory(state, designs, state.selectedDesignId);
  }),
  toggleLock: (id) => set((state) => {
    const designs = copyDesigns(state.designs);
    designs[state.activeSide] = designs[state.activeSide].map((design) => design.id === id ? { ...design, locked: !design.locked } : design);
    return withHistory(state, designs, state.selectedDesignId);
  }),
  deleteSelected: () => set((state) => {
    const design = selectedDesign(state);
    if (!design || design.locked) return state;
    const designs = copyDesigns(state.designs);
    designs[state.activeSide] = designs[state.activeSide].filter((item) => item.id !== design.id);
    return withHistory(state, designs, null);
  }),
  duplicateSelected: () => set((state) => {
    const design = selectedDesign(state);
    if (!design || design.locked) return state;
    const duplicate: Design = { ...design, id: crypto.randomUUID(), name: `${design.name} copia`, x: design.x + 24, y: design.y + 24, locked: false };
    const designs = copyDesigns(state.designs);
    designs[state.activeSide] = [...designs[state.activeSide], duplicate];
    return withHistory(state, designs, duplicate.id);
  }),
  moveLayer: (id, direction) => set((state) => {
    const designs = copyDesigns(state.designs);
    const list = designs[state.activeSide];
    const index = list.findIndex((design) => design.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return state;
    [list[index], list[nextIndex]] = [list[nextIndex]!, list[index]!];
    return withHistory(state, designs, state.selectedDesignId);
  }),
  undo: () => set((state) => {
    const previous = state.past.at(-1);
    if (!previous) return state;
    const future = [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT);
    const past = state.past.slice(0, -1);
    const next = { ...previous, past, future };
    revokeUnusedObjectUrls(collectUrls([next, ...past, ...future]));
    return next;
  }),
  redo: () => set((state) => {
    const nextSnapshot = state.future[0];
    if (!nextSnapshot) return state;
    const past = [...state.past, snapshot(state)].slice(-HISTORY_LIMIT);
    const future = state.future.slice(1);
    const next = { ...nextSnapshot, past, future };
    revokeUnusedObjectUrls(collectUrls([next, ...past, ...future]));
    return next;
  }),
}));
