import { invoke } from "@tauri-apps/api/core";
import { showSaveDialog } from "../../lib/tauri";
import type { VibeEvent, SliceCreator, EventSlice } from "../types";

interface VibeEventRaw {
  id: string;
  session_id: string;
  timestamp: string;
  kind: string;
  action_type: string | null;
  detail: string | null;
  actor: string | null;
  metadata: string | null;
  rationale: string | null;
  confidence: number | null;
  impact_category: string | null;
  reversible: boolean | null;
  related_files: string | null;
  related_tickets: string | null;
}

function mapRawEvent(raw: VibeEventRaw): VibeEvent {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    timestamp: raw.timestamp,
    kind: raw.kind as VibeEvent["kind"],
    actionType: raw.action_type ?? undefined,
    detail: raw.detail ?? undefined,
    actor: raw.actor ?? undefined,
    metadata: raw.metadata ?? undefined,
    rationale: raw.rationale ?? undefined,
    confidence: raw.confidence ?? undefined,
    impactCategory: raw.impact_category ?? undefined,
    reversible: raw.reversible ?? undefined,
    relatedFiles: raw.related_files ?? undefined,
    relatedTickets: raw.related_tickets ?? undefined,
  };
}

export const createEventSlice: SliceCreator<EventSlice> = (set) => ({
  events: [],
  eventsLoading: false,

  loadEvents: async (sessionId, kind?, limit?) => {
    set({ eventsLoading: true });
    try {
      const raw = await invoke<VibeEventRaw[]>("get_events", {
        sessionId,
        kind: kind ?? null,
        limit: limit ?? null,
      });
      const events = raw.map(mapRawEvent);
      set({ events, eventsLoading: false });
    } catch (e) {
      console.error("Failed to load events:", e);
      set({ eventsLoading: false });
    }
  },

  logEvent: async (
    sessionId,
    kind,
    actionType?,
    detail?,
    actor?,
    metadata?,
    rationale?,
    confidence?,
    impactCategory?,
    reversible?,
    relatedFiles?,
    relatedTickets?,
  ) => {
    try {
      const raw = await invoke<VibeEventRaw>("log_event", {
        sessionId,
        kind,
        actionType: actionType ?? null,
        detail: detail ?? null,
        actor: actor ?? null,
        metadata: metadata ?? null,
        rationale: rationale ?? null,
        confidence: confidence ?? null,
        impactCategory: impactCategory ?? null,
        reversible: reversible ?? null,
        relatedFiles: relatedFiles ?? null,
        relatedTickets: relatedTickets ?? null,
      });
      const newEvent = mapRawEvent(raw);
      set((state) => ({ events: [newEvent, ...state.events] }));
    } catch (e) {
      console.error("Failed to log event:", e);
    }
  },

  exportEvents: async (sessionId, format) => {
    const ext = format === "csv" ? "csv" : "json";
    const path = await showSaveDialog(`events-export.${ext}`, [
      { name: format.toUpperCase(), extensions: [ext] },
    ]);
    if (!path) return;
    try {
      await invoke<void>("export_events", {
        sessionId,
        format,
        outputPath: path,
      });
    } catch (e) {
      console.error("Failed to export events:", e);
    }
  },
});
