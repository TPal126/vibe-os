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

  describe("quadrant panes", () => {
    it("defaults to correct active tabs per pane", () => {
      const state = store.getState();
      expect(state.topRightTab).toBe("architecture");
      expect(state.bottomLeftTab).toBe("resources");
      expect(state.bottomRightTab).toBe("audit");
    });

    it("setTopRightTab changes tab", () => {
      store.getState().setTopRightTab("graph");
      expect(store.getState().topRightTab).toBe("graph");
    });

    it("setBottomLeftTab changes tab", () => {
      store.getState().setBottomLeftTab("repos");
      expect(store.getState().bottomLeftTab).toBe("repos");
    });

    it("setBottomRightTab changes tab", () => {
      store.getState().setBottomRightTab("decisions");
      expect(store.getState().bottomRightTab).toBe("decisions");
    });

    it("maximized pane defaults to null", () => {
      expect(store.getState().maximizedPane).toBeNull();
    });

    it("setMaximizedPane sets and clears", () => {
      store.getState().setMaximizedPane("top-right");
      expect(store.getState().maximizedPane).toBe("top-right");
      store.getState().setMaximizedPane(null);
      expect(store.getState().maximizedPane).toBeNull();
    });

    it("pinnedPanes defaults to empty set", () => {
      expect(store.getState().pinnedPanes.size).toBe(0);
    });

    it("togglePinnedPane adds and removes", () => {
      store.getState().togglePinnedPane("bottom-left");
      expect(store.getState().pinnedPanes.has("bottom-left")).toBe(true);
      store.getState().togglePinnedPane("bottom-left");
      expect(store.getState().pinnedPanes.has("bottom-left")).toBe(false);
    });
  });
});
