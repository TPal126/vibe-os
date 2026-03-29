import { ClaudeChat } from "../panels/ClaudeChat";
import { SecondaryDrawer } from "./SecondaryDrawer";
import { HomeScreen } from "../home/HomeScreen";
import { useAppStore } from "../../stores";

export function MainLayout() {
  const currentView = useAppStore((s) => s.currentView);

  return (
    <div className="flex-1 overflow-hidden relative">
      {currentView === "home" ? <HomeScreen /> : <ClaudeChat />}
      {currentView === "conversation" && <SecondaryDrawer />}
    </div>
  );
}
