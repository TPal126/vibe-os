import type { SliceCreator, SessionSlice } from "../types";
import type { SessionData } from "../../lib/tauri";
import { commands } from "../../lib/tauri";

export const createSessionSlice: SliceCreator<SessionSlice> = (set) => ({
  activeSession: null,

  createSession: async () => {
    try {
      const session = await commands.createSession();
      set({
        activeSession: { id: session.id, startedAt: session.startedAt },
      });
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  },

  endSession: async () => {
    try {
      await commands.endSession();
      set({ activeSession: null });
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  },

  loadActiveSession: async (): Promise<SessionData | null> => {
    try {
      const session = await commands.getActiveSession();
      if (session) {
        set({
          activeSession: { id: session.id, startedAt: session.startedAt },
          // Restore system prompt from session data
          systemPrompt: session.systemPrompt || "",
        });
        // Return session data so the App init can restore active repo/skill toggles
        return session;
      }
      return null;
    } catch (err) {
      console.error("Failed to load active session:", err);
      return null;
    }
  },
});
