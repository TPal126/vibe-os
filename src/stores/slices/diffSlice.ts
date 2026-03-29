import type { SliceCreator, DiffSlice } from "../types";
import { commands } from "../../lib/tauri";

export const createDiffSlice: SliceCreator<DiffSlice> = (set, get) => ({
  pendingDiffs: [],
  activeDiffId: null,

  addPendingDiff: (diff) =>
    set((state) => ({
      pendingDiffs: [
        ...state.pendingDiffs,
        { ...diff, id: crypto.randomUUID(), status: "pending" as const },
      ],
    })),

  acceptDiff: async (id: string) => {
    const diff = get().pendingDiffs.find((d) => d.id === id);
    if (!diff) return;

    try {
      await commands.writeFile(diff.filePath, diff.proposedContent);
      await commands
        .logAction(
          "FILE_MODIFY",
          `Accepted diff for: ${diff.filePath}`,
          "user",
        )
        .catch(() => {}); // best-effort audit

      // Update open editor if this file is open
      const openFile = get().openFiles.find((f) => f.path === diff.filePath);
      if (openFile) {
        get().updateFileContent(diff.filePath, diff.proposedContent);
      }

      set((state) => ({
        pendingDiffs: state.pendingDiffs.filter((d) => d.id !== id),
        activeDiffId: state.activeDiffId === id ? null : state.activeDiffId,
      }));
    } catch (e) {
      console.error("Failed to accept diff:", e);
    }
  },

  rejectDiff: (id: string) => {
    commands
      .logAction("FILE_REJECT", `Rejected diff for file`, "user")
      .catch(() => {}); // best-effort audit

    set((state) => ({
      pendingDiffs: state.pendingDiffs.filter((d) => d.id !== id),
      activeDiffId: state.activeDiffId === id ? null : state.activeDiffId,
    }));
  },

  setActiveDiff: (id: string | null) => set({ activeDiffId: id }),
});
