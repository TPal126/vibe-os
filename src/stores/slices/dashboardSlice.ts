import type { SliceCreator, DashboardSlice } from "../types";

export const createDashboardSlice: SliceCreator<DashboardSlice> = (set) => ({
  sessionGoal: "",
  setSessionGoal: (goal: string) => set({ sessionGoal: goal }),
});
