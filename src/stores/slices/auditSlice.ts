import { commands, showSaveDialog } from "../../lib/tauri";
import type { AuditEntry, SliceCreator, AuditSlice } from "../types";

export const createAuditSlice: SliceCreator<AuditSlice> = (set, get) => ({
  auditEntries: [],
  auditLoading: false,

  loadAuditLog: async () => {
    const session = get().activeSession;
    if (!session) return;
    set({ auditLoading: true });
    try {
      const raw = await commands.getSessionAudit(session.id);
      const entries: AuditEntry[] = raw.map((e) => ({
        id: e.id,
        sessionId: e.session_id,
        timestamp: e.timestamp,
        actionType: e.action_type,
        detail: e.detail,
        actor: e.actor as AuditEntry["actor"],
        metadata: e.metadata,
      }));
      set({ auditEntries: entries, auditLoading: false });
    } catch (e) {
      console.error("Failed to load audit log:", e);
      set({ auditLoading: false });
    }
  },

  exportAuditLog: async (format) => {
    const session = get().activeSession;
    if (!session) return;
    const ext = format === "csv" ? "csv" : "json";
    const path = await showSaveDialog(`audit-log-export.${ext}`, [
      { name: format.toUpperCase(), extensions: [ext] },
    ]);
    if (!path) return;
    try {
      await commands.exportAuditLog(session.id, format, path);
    } catch (e) {
      console.error("Failed to export audit log:", e);
    }
  },
});
