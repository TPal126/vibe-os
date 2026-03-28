import type { StateStorage } from "zustand/middleware";
import { commands } from "../lib/tauri";

/**
 * Custom StateStorage that reads/writes to SQLite via Tauri commands.
 * The settings table (key TEXT PRIMARY KEY, value TEXT) stores JSON blobs.
 * This bridges Zustand's persist middleware to the SQLite backend.
 */
export const tauriSqliteStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await commands.getSetting(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await commands.saveSetting(name, value);
    } catch (err) {
      console.error("Failed to persist state to SQLite:", err);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await commands.deleteSetting(name);
    } catch (err) {
      console.error("Failed to remove state from SQLite:", err);
    }
  },
};
