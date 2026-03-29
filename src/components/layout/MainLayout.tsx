import { ClaudeChat } from "../panels/ClaudeChat";
import { SettingsPanel } from "../settings/SettingsPanel";
import { EditorPanel } from "../editor/EditorPanel";
import { HomeScreen } from "../home/HomeScreen";
import { useAppStore } from "../../stores";

export function MainLayout() {
  const currentView = useAppStore((s) => s.currentView);

  return (
    <div className="flex-1 overflow-hidden relative">
      {currentView === "home" ? <HomeScreen /> : <ClaudeChat />}
      {currentView === "conversation" && (
        <>
          <SettingsPanel />
          <EditorPanel />
        </>
      )}
    </div>
  );
}
