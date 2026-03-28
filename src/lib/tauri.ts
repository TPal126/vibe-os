import { invoke } from "@tauri-apps/api/core";

/**
 * Typed command wrappers for all Tauri IPC commands.
 * Each method maps to a #[tauri::command] in the Rust backend.
 */
export const commands = {
  /** Write a test row to the settings table */
  testDbWrite: () => invoke<string>("test_db_write"),

  /** Read the test row back from the settings table */
  testDbRead: () => invoke<string>("test_db_read"),
};
