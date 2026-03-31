import { HomeScreen } from "../home/HomeScreen";
import { ProjectSetupView } from "../home/ProjectSetupView";
import { EditorPanel } from "../editor/EditorPanel";
import { QuadrantLayout } from "./QuadrantLayout";
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

  if (currentView === "project-setup") {
    return (
      <div className="flex-1 overflow-hidden relative">
        <ProjectSetupView />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden relative">
      <QuadrantLayout />
      <EditorPanel />
    </div>
  );
}
