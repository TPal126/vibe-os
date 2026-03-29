import { useEffect } from "react";
import { TitleBar } from "./components/layout/TitleBar";
import { MainLayout } from "./components/layout/MainLayout";
import { useAppStore } from "./stores";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useWorkspaceWatcher } from "./hooks/useWorkspaceWatcher";
import { useClaudeStream } from "./hooks/useClaudeStream";

function App() {
  useKeyboardShortcuts();
  useWorkspaceWatcher();
  useClaudeStream();

  const loadActiveSession = useAppStore((s) => s.loadActiveSession);
  const createSession = useAppStore((s) => s.createSession);
  const validateClaudeCli = useAppStore((s) => s.validateClaudeCli);
  const loadProjects = useAppStore((s) => s.loadProjects);

  useEffect(() => {
    async function init() {
      // 0. Validate Claude CLI availability (non-blocking)
      validateClaudeCli().catch(() => {});

      // 1. Load persisted projects
      await loadProjects();

      // 2. Load app session (backward compat)
      await loadActiveSession();
      const session = useAppStore.getState().activeSession;
      if (!session) {
        await createSession();
      }

      // 3. Hydrate Claude sessions for each project
      const { projects, claudeSessions, createClaudeSessionLocal } =
        useAppStore.getState();
      for (const project of projects) {
        if (!claudeSessions.has(project.claudeSessionId)) {
          createClaudeSessionLocal(project.claudeSessionId, project.name);
        }
      }

      // Workspace/repos/skills load per-project on card click
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen flex flex-col bg-v-bg overflow-hidden">
      <TitleBar />
      <MainLayout />
    </div>
  );
}

export default App;
