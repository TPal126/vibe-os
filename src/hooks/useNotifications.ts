import { useEffect, useRef } from "react";
import { useAppStore } from "../stores";
import { getAttentionItems } from "../lib/attention";
import type { AttentionItem } from "../lib/attention";

/**
 * Fires OS-level notifications when projects transition into
 * needs-input or error states. Only notifies for non-active projects.
 * Deduplicates: only fires once per project per attention event.
 *
 * Note: Uses single-argument subscribe(state) with ref-based previous
 * state tracking. The store does not use subscribeWithSelector middleware,
 * so two-argument subscribe(state, prevState) is not available.
 */
export function useNotifications() {
  const prevItemsRef = useRef<AttentionItem[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = useAppStore.subscribe((state) => {
      const items = getAttentionItems(state.projects, state.agentSessions);

      // Find newly flagged items (not in previous snapshot)
      const prevIds = new Set(prevItemsRef.current.map((i) => i.sessionId));
      const newItems = items.filter((i) => !prevIds.has(i.sessionId));

      for (const item of newItems) {
        if (notifiedRef.current.has(item.sessionId)) continue;
        notifiedRef.current.add(item.sessionId);
        fireNotification(item);
      }

      // Clean up notified set for items no longer flagged
      const currentIds = new Set(items.map((i) => i.sessionId));
      for (const id of notifiedRef.current) {
        if (!currentIds.has(id)) {
          notifiedRef.current.delete(id);
        }
      }

      // Update previous snapshot
      prevItemsRef.current = items;
    });

    return () => unsub();
  }, []);
}

async function fireNotification(item: AttentionItem) {
  try {
    // Dynamic import to avoid issues in non-Tauri environments (tests)
    const { isPermissionGranted, requestPermission, sendNotification } =
      await import("@tauri-apps/plugin-notification");

    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }

    if (granted) {
      const title =
        item.status === "error"
          ? `Error: ${item.projectName}`
          : `${item.projectName} needs you`;
      const body = item.preview;

      sendNotification({ title, body });
    }
  } catch (err) {
    // Graceful fallback -- notifications not available
    console.warn("[vibe-os] Notification failed:", err);
  }
}
