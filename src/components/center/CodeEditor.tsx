import { useRef, useEffect, useCallback } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import type { editor as monacoEditor } from "monaco-editor";
import * as monaco from "monaco-editor";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { VIBE_OS_THEME, VIBE_OS_THEME_NAME } from "../../lib/monacoTheme";
import { EditorTabs } from "./EditorTabs";

/**
 * CodeEditor -- Monaco editor with manual model management, multi-tab support,
 * view state save/restore, and Ctrl+S save handler.
 */
export function CodeEditor() {
  const { openFiles, activeFilePath, updateFileContent } = useAppStore(
    useShallow((s) => ({
      openFiles: s.openFiles,
      activeFilePath: s.activeFilePath,
      updateFileContent: s.updateFileContent,
    })),
  );

  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);
  const viewStatesRef = useRef<
    Map<string, monacoEditor.ICodeEditorViewState | null>
  >(new Map());
  const prevFilePathsRef = useRef<Set<string>>(new Set());

  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null;

  /** Save view state for current model before switching. */
  const saveCurrentViewState = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (model) {
      const uri = model.uri.toString();
      viewStatesRef.current.set(uri, ed.saveViewState());
    }
  }, []);

  /** Define the VIBE OS theme before Monaco mounts. */
  const handleBeforeMount: BeforeMount = useCallback((m) => {
    m.editor.defineTheme(VIBE_OS_THEME_NAME, VIBE_OS_THEME);
  }, []);

  /** Store editor ref and register Ctrl+S on mount. */
  const handleMount: OnMount = useCallback(
    (ed) => {
      editorRef.current = ed;

      // Ctrl+S / Cmd+S save handler
      ed.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          const currentPath = useAppStore.getState().activeFilePath;
          if (currentPath) {
            useAppStore.getState().saveFile(currentPath);
          }
        },
      );
    },
    [],
  );

  /**
   * Switch model when activeFilePath changes.
   * Creates or retrieves the Monaco model, sets it on the editor,
   * and restores the view state if one was saved previously.
   */
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !activeFile) return;

    saveCurrentViewState();

    const uri = monaco.Uri.parse(`file:///${activeFile.path.replace(/\\/g, "/")}`);
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel(
        activeFile.content,
        activeFile.language,
        uri,
      );
    }

    ed.setModel(model);

    // Restore view state if previously saved
    const savedState = viewStatesRef.current.get(uri.toString());
    if (savedState) {
      ed.restoreViewState(savedState);
    }

    ed.focus();
  }, [activeFilePath, activeFile, saveCurrentViewState]);

  /**
   * Dispose models for tabs that were closed.
   * Compares previous open file paths with current to detect removals.
   */
  useEffect(() => {
    const currentPaths = new Set(openFiles.map((f) => f.path));
    const prevPaths = prevFilePathsRef.current;

    for (const path of prevPaths) {
      if (!currentPaths.has(path)) {
        // This tab was closed -- dispose its model
        const uri = monaco.Uri.parse(`file:///${path.replace(/\\/g, "/")}`);
        const model = monaco.editor.getModel(uri);
        if (model) {
          model.dispose();
        }
        viewStatesRef.current.delete(uri.toString());
      }
    }

    prevFilePathsRef.current = currentPaths;
  }, [openFiles]);

  /** Handle content changes from the editor. */
  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined && activeFilePath) {
        updateFileContent(activeFilePath, value);
      }
    },
    [activeFilePath, updateFileContent],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <EditorTabs />
      {activeFile ? (
        <div className="flex-1 overflow-hidden">
          <Editor
            theme={VIBE_OS_THEME_NAME}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            onChange={handleChange}
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 20,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              renderWhitespace: "selection",
              automaticLayout: true,
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-v-dim text-sm">
            Open a file to start editing
          </span>
        </div>
      )}
    </div>
  );
}
