import { useRef } from "react";
import { X, Code } from "lucide-react";
import { CodeEditor } from "../center/CodeEditor";
import { useAppStore } from "../../stores";

export function EditorPanel() {
  const isOpen = useAppStore((s) => s.editorPanelOpen);
  const setOpen = useAppStore((s) => s.setEditorPanelOpen);
  const close = () => setOpen(false);

  // Defer Monaco mount until first open, then keep mounted via CSS display toggle
  const hasOpened = useRef(false);
  if (isOpen) hasOpened.current = true;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={close} />
      )}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-v-bg border-t border-v-border flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "60vh" }}
      >
        <div className="flex items-center shrink-0 border-b border-v-border px-3 py-1">
          <Code size={12} className="text-v-dim mr-2" />
          <span className="text-[10px] font-sans font-bold text-v-dim tracking-[0.08em] uppercase">
            EDITOR
          </span>
          <span className="text-[9px] text-v-dim/50 ml-2">
            Ctrl+Shift+C to toggle
          </span>
          <div className="flex-1" />
          <button
            onClick={close}
            className="px-2 py-1 text-v-dim hover:text-v-text transition-colors"
            title="Close editor"
          >
            <X size={14} />
          </button>
        </div>
        {hasOpened.current && (
          <div
            className="flex-1 overflow-hidden"
            style={{ display: isOpen ? "block" : "none" }}
          >
            <CodeEditor />
          </div>
        )}
      </div>
    </>
  );
}
