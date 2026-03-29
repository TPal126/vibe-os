import type { SliceCreator, LayoutSlice } from "../types";

export const createLayoutSlice: SliceCreator<LayoutSlice> = (set) => ({
  drawerOpen: false,
  activeDrawerTab: "editor",
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  setDrawerOpen: (open: boolean) => set({ drawerOpen: open }),
  setActiveDrawerTab: (tab: string) => set({ activeDrawerTab: tab }),
  openDrawerToTab: (tab: string) =>
    set({ drawerOpen: true, activeDrawerTab: tab }),
});
