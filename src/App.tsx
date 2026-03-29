import { useEffect } from "react";
import { TitleBar } from "./components/layout/TitleBar";
import { MainLayout } from "./components/layout/MainLayout";
import { StatusBar } from "./components/layout/StatusBar";
import { useAppStore } from "./stores";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

function App() {
  useKeyboardShortcuts();

  const loadActiveSession = useAppStore((s) => s.loadActiveSession);
  const createSession = useAppStore((s) => s.createSession);
  const loadRepos = useAppStore((s) => s.loadRepos);
  const discoverSkills = useAppStore((s) => s.discoverSkills);
  const recompose = useAppStore((s) => s.recompose);

  useEffect(() => {
    async function init() {
      // 1. Try to load an existing active session (returns session data with linked repos/skills)
      const sessionData = await loadActiveSession();
      const session = useAppStore.getState().activeSession;

      // 2. If no active session, create one
      if (!session) {
        await createSession();
      }

      // 3. Load repos from disk
      await loadRepos();

      // 4. Discover skills from global + project dirs
      await discoverSkills();

      // 5. Restore active toggles from session data
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

      // 6. Compose initial prompt
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
      <StatusBar />
    </div>
  );
}

export default App;
