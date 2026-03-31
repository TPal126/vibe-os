import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { createLayoutSlice } from "./layoutSlice";
import type { LayoutSlice } from "../types";

function createTestStore() {
  return create<LayoutSlice>()(
    (...a) => createLayoutSlice(...(a as Parameters<typeof createLayoutSlice>))
  );
}

describe("layoutSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe("editor panel", () => {
    it("defaults to closed", () => {
      expect(store.getState().editorPanelOpen).toBe(false);
    });

    it("toggleEditorPanel toggles open/closed", () => {
      store.getState().toggleEditorPanel();
      expect(store.getState().editorPanelOpen).toBe(true);
      store.getState().toggleEditorPanel();
      expect(store.getState().editorPanelOpen).toBe(false);
    });

    it("setEditorPanelOpen sets directly", () => {
      store.getState().setEditorPanelOpen(true);
      expect(store.getState().editorPanelOpen).toBe(true);
    });
  });

  describe("settings panel", () => {
    it("defaults to closed with repos tab", () => {
      expect(store.getState().settingsPanelOpen).toBe(false);
      expect(store.getState().settingsPanelTab).toBe("repos");
    });

    it("toggleSettingsPanel toggles", () => {
      store.getState().toggleSettingsPanel();
      expect(store.getState().settingsPanelOpen).toBe(true);
      store.getState().toggleSettingsPanel();
      expect(store.getState().settingsPanelOpen).toBe(false);
    });

    it("setSettingsPanelTab changes tab", () => {
      store.getState().setSettingsPanelTab("graph");
      expect(store.getState().settingsPanelTab).toBe("graph");
    });
  });
});
