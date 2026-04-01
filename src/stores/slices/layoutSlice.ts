import type { SliceCreator, LayoutSlice, PaneId } from "../types";

export const createLayoutSlice: SliceCreator<LayoutSlice> = (set) => ({
  drawerOpen: false,
  activeDrawerTab: "editor",
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  setDrawerOpen: (open: boolean) => set({ drawerOpen: open }),
  setActiveDrawerTab: (tab: string) => set({ activeDrawerTab: tab }),
  openDrawerToTab: (tab: string) =>
    set({ drawerOpen: true, activeDrawerTab: tab }),

  // Editor panel
  editorPanelOpen: false,
  toggleEditorPanel: () =>
    set((s) => ({ editorPanelOpen: !s.editorPanelOpen })),
  setEditorPanelOpen: (open) => set({ editorPanelOpen: open }),

  // Quadrant pane tabs
  topRightTab: "architecture",
  bottomLeftTab: "resources",
  bottomRightTab: "audit",
  setTopRightTab: (tab) => set({ topRightTab: tab }),
  setBottomLeftTab: (tab) => set({ bottomLeftTab: tab }),
  setBottomRightTab: (tab) => set({ bottomRightTab: tab }),

  // Quadrant pane state
  maximizedPane: null,
  setMaximizedPane: (pane) => set({ maximizedPane: pane }),
  pinnedPanes: new Set<PaneId>(),
  togglePinnedPane: (pane) =>
    set((s) => {
      const next = new Set(s.pinnedPanes);
      if (next.has(pane)) next.delete(pane);
      else next.add(pane);
      return { pinnedPanes: next };
    }),
});
