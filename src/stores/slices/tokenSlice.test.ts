import { describe, it, expect, beforeEach, vi } from "vitest";
import { create } from "zustand";
import { createTokenSlice } from "./tokenSlice";
import type { TokenSlice } from "../types";

vi.mock("../../lib/tauri", () => ({
  commands: {
    getTokenBudgets: vi.fn().mockResolvedValue([
      {
        id: "b-1",
        scope_type: "skill",
        scope_id: "skill-abc",
        max_tokens: 5000,
        warning_threshold: 4000,
        created_at: "2026-03-30T00:00:00Z",
        updated_at: "2026-03-30T00:00:00Z",
      },
    ]),
    setTokenBudget: vi.fn().mockImplementation(
      (scopeType: string, scopeId: string, maxTokens: number, warningThreshold: number) =>
        Promise.resolve({
          id: "b-new",
          scope_type: scopeType,
          scope_id: scopeId,
          max_tokens: maxTokens,
          warning_threshold: warningThreshold ?? 0.8 * maxTokens,
          created_at: "2026-03-30T00:00:00Z",
          updated_at: "2026-03-30T00:00:00Z",
        })
    ),
    deleteTokenBudget: vi.fn().mockResolvedValue(undefined),
  },
}));

function createTestStore() {
  return create<TokenSlice>()(
    (...a) => createTokenSlice(...(a as Parameters<typeof createTokenSlice>))
  );
}

describe("tokenSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("starts empty", () => {
    expect(store.getState().tokenBudgets).toHaveLength(0);
    expect(store.getState().tokenBudgetsLoading).toBe(false);
  });

  it("loadTokenBudgets populates from backend", async () => {
    await store.getState().loadTokenBudgets();
    expect(store.getState().tokenBudgets).toHaveLength(1);
    expect(store.getState().tokenBudgets[0].scopeType).toBe("skill");
    expect(store.getState().tokenBudgets[0].maxTokens).toBe(5000);
  });

  it("getSkillBudget finds by skillId", async () => {
    await store.getState().loadTokenBudgets();
    const budget = store.getState().getSkillBudget("skill-abc");
    expect(budget).toBeDefined();
    expect(budget!.maxTokens).toBe(5000);
  });

  it("getRepoBudget returns undefined for missing repo", async () => {
    await store.getState().loadTokenBudgets();
    expect(store.getState().getRepoBudget("nonexistent")).toBeUndefined();
  });

  it("getSessionBudget finds session-scoped budget", () => {
    store.setState({
      tokenBudgets: [{
        id: "b-s",
        scopeType: "session",
        scopeId: "global",
        maxTokens: 100000,
        warningThreshold: 80000,
        createdAt: "",
        updatedAt: "",
      }],
    });
    expect(store.getState().getSessionBudget()).toBeDefined();
    expect(store.getState().getSessionBudget()!.maxTokens).toBe(100000);
  });
});
