import type { SliceCreator, EditorSlice, EditorFile } from "../types";
import { commands } from "../../lib/tauri";

/**
 * Detect Monaco language identifier from a file extension.
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    py: "python",
    md: "markdown",
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    json: "json",
    rs: "rust",
    toml: "toml",
    html: "html",
    css: "css",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    sql: "sql",
  };
  return map[ext] ?? "plaintext";
}

/**
 * Extract the filename from a full file path.
 */
function extractFileName(filePath: string): string {
  // Handle both forward and back slashes
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? filePath;
}

export const createEditorSlice: SliceCreator<EditorSlice> = (set, get) => ({
  openFiles: [],
  activeFilePath: null,

  openFile: async (path: string) => {
    const existing = get().openFiles.find((f) => f.path === path);
    if (existing) {
      set({ activeFilePath: path });
      return;
    }

    try {
      const content = await commands.readFile(path);
      const file: EditorFile = {
        path,
        name: extractFileName(path),
        language: detectLanguage(path),
        content,
        isDirty: false,
      };

      set((state) => ({
        openFiles: [...state.openFiles, file],
        activeFilePath: path,
      }));
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  },

  closeFile: (path: string) => {
    set((state) => {
      const newFiles = state.openFiles.filter((f) => f.path !== path);
      let newActive = state.activeFilePath;

      if (state.activeFilePath === path) {
        // Activate the previous tab, or the first remaining, or null
        const closedIndex = state.openFiles.findIndex((f) => f.path === path);
        if (newFiles.length === 0) {
          newActive = null;
        } else if (closedIndex > 0) {
          newActive = newFiles[closedIndex - 1].path;
        } else {
          newActive = newFiles[0].path;
        }
      }

      return { openFiles: newFiles, activeFilePath: newActive };
    });
  },

  setActiveFile: (path: string) => {
    set({ activeFilePath: path });
  },

  updateFileContent: (path: string, content: string) => {
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: true } : f,
      ),
    }));
  },

  saveFile: async (path: string) => {
    const file = get().openFiles.find((f) => f.path === path);
    if (!file) return;

    try {
      await commands.writeFile(path, file.content);
      set((state) => ({
        openFiles: state.openFiles.map((f) =>
          f.path === path ? { ...f, isDirty: false } : f,
        ),
      }));
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  },
});
