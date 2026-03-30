import { ClaudeChat } from "../panels/ClaudeChat";
import { SettingsPanel } from "../settings/SettingsPanel";
import { EditorPanel } from "../editor/EditorPanel";
import { HomeScreen } from "../home/HomeScreen";
import { useAppStore } from "../../stores";

export function MainLayout() {
  const currentView = useAppStore((s) => s.currentView);

  if (currentView === "home") {
    return (
      <div className="flex-1 overflow-hidden relative">
        <HomeScreen />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden relative flex">
      <div className="flex-1 overflow-hidden">
        <ClaudeChat />
      </div>
      <SettingsPanel />
      <EditorPanel />
    </div>
  );
}
