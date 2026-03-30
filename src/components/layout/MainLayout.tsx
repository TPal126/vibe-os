import { useState, useCallback, useRef } from "react";
import { ClaudeChat } from "../panels/ClaudeChat";
import { SettingsPanel } from "../settings/SettingsPanel";
import { EditorPanel } from "../editor/EditorPanel";
import { HomeScreen } from "../home/HomeScreen";
import { useAppStore } from "../../stores";

export function MainLayout() {
  const currentView = useAppStore((s) => s.currentView);
  const [settingsWidth, setSettingsWidth] = useState(400);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = rect.right - ev.clientX;
      setSettingsWidth(Math.max(240, Math.min(newWidth, rect.width - 300)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  if (currentView === "home") {
    return (
      <div className="flex-1 overflow-hidden relative">
        <HomeScreen />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative flex">
      <div className="flex-1 overflow-hidden min-w-[300px]">
        <ClaudeChat />
      </div>
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 shrink-0 bg-v-border hover:bg-v-accent/50 cursor-col-resize transition-colors"
      />
      <div style={{ width: settingsWidth }} className="shrink-0 overflow-hidden">
        <SettingsPanel />
      </div>
      <EditorPanel />
    </div>
  );
}
