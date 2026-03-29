import type { editor } from "monaco-editor";

export const VIBE_OS_THEME_NAME = "vibe-os-dark";

export const VIBE_OS_THEME: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "5a6080", fontStyle: "italic" },
    { token: "keyword", foreground: "5b7cfa", fontStyle: "bold" },
    { token: "string", foreground: "34d399" },
    { token: "number", foreground: "fbbf24" },
    { token: "type", foreground: "22d3ee" },
    { token: "function", foreground: "7d9bff" },
    { token: "variable", foreground: "b8bdd4" },
    { token: "operator", foreground: "e1e4f0" },
    { token: "delimiter", foreground: "5a6080" },
    { token: "string.escape", foreground: "f97316" },
  ],
  colors: {
    "editor.background": "#12141c",
    "editor.foreground": "#b8bdd4",
    "editor.lineHighlightBackground": "#181b26",
    "editor.selectionBackground": "#2a3466",
    "editorCursor.foreground": "#5b7cfa",
    "editorLineNumber.foreground": "#5a6080",
    "editorLineNumber.activeForeground": "#7d9bff",
    "editorGutter.background": "#0c0e14",
    "editorWidget.background": "#12141c",
    "editorWidget.border": "#232738",
    "editorSuggestWidget.background": "#12141c",
    "editorSuggestWidget.border": "#232738",
    "editorSuggestWidget.selectedBackground": "#181b26",
    "editor.wordHighlightBackground": "#2a346640",
    "editorBracketMatch.background": "#2a346660",
    "editorBracketMatch.border": "#5b7cfa40",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#2e334740",
    "scrollbarSlider.hoverBackground": "#5a608060",
    "scrollbarSlider.activeBackground": "#5b7cfa40",
    "minimap.background": "#0c0e14",
  },
};
