import type { SliceCreator, ThemeSlice } from "../types";
import { commands } from "../../lib/tauri";

const THEME_SETTING_KEY = "theme";

export const createThemeSlice: SliceCreator<ThemeSlice> = (set) => {
  // Load theme from settings on init and apply before first render
  commands.getSetting(THEME_SETTING_KEY).then((saved) => {
    const theme = saved === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  }).catch(() => {});

  return {
    theme: "dark",

    setTheme: (theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      set({ theme });
      commands.saveSetting(THEME_SETTING_KEY, theme).catch(() => {});
    },
  };
};
