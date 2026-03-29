import type { SliceCreator, LayoutSlice } from "../types";

export const createLayoutSlice: SliceCreator<LayoutSlice> = (set) => ({
  drawerOpen: false,
  activeDrawerTab: "editor",
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  setDrawerOpen: (open: boolean) => set({ drawerOpen: open }),
  setActiveDrawerTab: (tab: string) => set({ activeDrawerTab: tab }),
  openDrawerToTab: (tab: string) =>
    set({ drawerOpen: true, activeDrawerTab: tab }),

  // Phase 17: Settings panel
  settingsPanelOpen: false,
  settingsPanelTab: "repos",
  toggleSettingsPanel: () =>
    set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),
  setSettingsPanelOpen: (open) => set({ settingsPanelOpen: open }),
  setSettingsPanelTab: (tab) => set({ settingsPanelTab: tab }),

  // Phase 17: Editor panel
  editorPanelOpen: false,
  toggleEditorPanel: () =>
    set((s) => ({ editorPanelOpen: !s.editorPanelOpen })),
  setEditorPanelOpen: (open) => set({ editorPanelOpen: open }),
});
