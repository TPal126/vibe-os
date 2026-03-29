import type { SliceCreator, PreviewSlice } from "../types";

export const createPreviewSlice: SliceCreator<PreviewSlice> = (set) => ({
  previewUrl: null,
  autoRefresh: true,

  setPreviewUrl: (url: string) => set({ previewUrl: url }),
  toggleAutoRefresh: () =>
    set((state) => ({ autoRefresh: !state.autoRefresh })),
});
