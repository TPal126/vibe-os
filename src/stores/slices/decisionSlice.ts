import { commands, showSaveDialog } from "../../lib/tauri";
import type { Decision, SliceCreator, DecisionSlice } from "../types";

export const createDecisionSlice: SliceCreator<DecisionSlice> = (set, get) => ({
  decisions: [],
  decisionsLoading: false,

  loadDecisions: async () => {
    const session = get().activeSession;
    if (!session) return;
    set({ decisionsLoading: true });
    try {
      const raw = await commands.getSessionDecisions(session.id);
      const decisions: Decision[] = raw.map((d) => ({
        id: d.id,
        sessionId: d.session_id,
        timestamp: d.timestamp,
        decision: d.decision,
        rationale: d.rationale,
        confidence: d.confidence,
        impactCategory: d.impact_category as Decision["impactCategory"],
        reversible: d.reversible,
        relatedFiles: d.related_files,
        relatedTickets: d.related_tickets,
      }));
      set({ decisions, decisionsLoading: false });
    } catch (e) {
      console.error("Failed to load decisions:", e);
      set({ decisionsLoading: false });
    }
  },

  recordDecision: async (
    decision,
    rationale,
    confidence,
    impactCategory,
    reversible,
    relatedFiles = [],
    relatedTickets = [],
  ) => {
    const session = get().activeSession;
    if (!session) return;
    try {
      const raw = await commands.recordDecision(
        session.id,
        decision,
        rationale,
        confidence,
        impactCategory,
        reversible,
        relatedFiles,
        relatedTickets,
      );
      const newDecision: Decision = {
        id: raw.id,
        sessionId: raw.session_id,
        timestamp: raw.timestamp,
        decision: raw.decision,
        rationale: raw.rationale,
        confidence: raw.confidence,
        impactCategory: raw.impact_category as Decision["impactCategory"],
        reversible: raw.reversible,
        relatedFiles: raw.related_files,
        relatedTickets: raw.related_tickets,
      };
      set((state) => ({ decisions: [newDecision, ...state.decisions] }));
    } catch (e) {
      console.error("Failed to record decision:", e);
    }
  },

  exportDecisions: async (format) => {
    const session = get().activeSession;
    if (!session) return;
    const ext = format === "csv" ? "csv" : "json";
    const path = await showSaveDialog(`decisions-export.${ext}`, [
      { name: format.toUpperCase(), extensions: [ext] },
    ]);
    if (!path) return;
    try {
      await commands.exportDecisions(session.id, format, path);
    } catch (e) {
      console.error("Failed to export decisions:", e);
    }
  },
});
