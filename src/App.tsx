import { useEffect } from "react";
import { TitleBar } from "./components/layout/TitleBar";
import { MainLayout } from "./components/layout/MainLayout";
import { useAppStore } from "./stores";
import { commands } from "./lib/tauri";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useWorkspaceWatcher } from "./hooks/useWorkspaceWatcher";

function App() {
  useKeyboardShortcuts();
  useWorkspaceWatcher();

  const loadActiveSession = useAppStore((s) => s.loadActiveSession);
  const createSession = useAppStore((s) => s.createSession);
  const loadRepos = useAppStore((s) => s.loadRepos);
  const discoverSkills = useAppStore((s) => s.discoverSkills);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const recompose = useAppStore((s) => s.recompose);
  const validateClaudeCli = useAppStore((s) => s.validateClaudeCli);

  useEffect(() => {
    async function init() {
      // 0. Validate Claude CLI availability (non-blocking, best-effort)
      // Note: may false-negative on Windows due to PATH resolution in GUI processes.
      // Real errors are caught at spawn time in start_claude with actionable messages.
      validateClaudeCli().catch(() => {});

      // 1. Try to load an existing active session (returns session data with linked repos/skills)
      const sessionData = await loadActiveSession();
      const session = useAppStore.getState().activeSession;

      // 2. If no active session, create one
      if (!session) {
        await createSession();
      }

      // 3. Restore active workspace from settings (if any)
      // openWorkspace already loads repos, skills, tree, and CLAUDE.md
      const savedWorkspacePath = await commands.getSetting("active_workspace_path");
      if (savedWorkspacePath) {
        try {
          await openWorkspace(savedWorkspacePath);
        } catch {
          // Workspace no longer valid -- clear setting and fall through to default loading
          await commands.deleteSetting("active_workspace_path");
          await loadRepos();
          await discoverSkills();
        }
      } else {
        // No workspace -- load repos and skills from global location
        await loadRepos();
        await discoverSkills();
      }

      // 4. Restore active toggles from session data
      // The session stores which repos/skills were active as JSON arrays of IDs.
      // After loading repos/skills, restore those toggles so the user's state persists across restarts.
      if (sessionData) {
        const activeRepoIds: string[] = JSON.parse(
          sessionData.activeRepos || "[]",
        );
        const activeSkillIds: string[] = JSON.parse(
          sessionData.activeSkills || "[]",
        );
        const state = useAppStore.getState();

        if (activeRepoIds.length > 0) {
          useAppStore.setState({
            repos: state.repos.map((r) => ({
              ...r,
              active: activeRepoIds.includes(r.id),
            })),
          });
        }

        if (activeSkillIds.length > 0) {
          useAppStore.setState({
            skills: state.skills.map((sk) => ({
              ...sk,
              active: activeSkillIds.includes(sk.id),
            })),
          });
        }
      }

      // 5. Compose initial prompt
      await recompose();
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally empty deps -- init runs once on mount only.
  // The functions are stable references from Zustand and do not change.

  return (
    <div className="h-screen flex flex-col bg-v-bg overflow-hidden">
      <TitleBar />
      <MainLayout />
    </div>
  );
}

export default App;
