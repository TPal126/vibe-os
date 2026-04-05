import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { EnhancedProjectCard } from "./EnhancedProjectCard";
import { NewProjectCard } from "./NewProjectCard";
import type { ClaudeSessionState } from "../../stores/types";

export function HomeScreen() {
  const {
    projects,
    claudeSessions,
    openProject,
    removeProject,
    clearAllProjects,
    setActiveClaudeSessionId,
    openWorkspace,
    goToSetup,
  } = useAppStore(
    useShallow((s) => ({
      projects: s.projects,
      claudeSessions: s.claudeSessions,
      openProject: s.openProject,
      removeProject: s.removeProject,
      clearAllProjects: s.clearAllProjects,
      setActiveClaudeSessionId: s.setActiveClaudeSessionId,
      openWorkspace: s.openWorkspace,
      goToSetup: s.goToSetup,
    })),
  );

  const handleOpenProject = async (project: { id: string; workspacePath: string; claudeSessionId: string }) => {
    openProject(project.id);
    setActiveClaudeSessionId(project.claudeSessionId);
    try {
      await openWorkspace(project.workspacePath);
    } catch (err) {
      console.warn("Workspace load failed, chat still works:", err);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-[360px]">
          <div className="text-4xl mb-3 opacity-25">⬡</div>
          <h2 className="text-lg font-semibold text-v-textHi mb-2">Welcome to VIBE OS</h2>
          <p className="text-[13px] text-v-dim leading-relaxed mb-6">
            Create a project to get started. You'll pick a name, link repos from your machine or GitHub, attach skills, and optionally add saved agents.
          </p>
          <button
            onClick={goToSetup}
            className="bg-v-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-v-accentHi transition-colors"
          >
            + New Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="grid grid-cols-3 gap-4 max-w-[720px] w-full">
        {projects.map((project) => {
          const projectSessions = new Map<string, ClaudeSessionState>();
          const primarySession = claudeSessions.get(project.claudeSessionId);
          if (primarySession) {
            projectSessions.set(primarySession.id, primarySession);
          }

          return (
            <EnhancedProjectCard
              key={project.id}
              project={project}
              sessions={projectSessions}
              onOpen={() => handleOpenProject(project)}
              onOpenSession={(sessionId) => {
                setActiveClaudeSessionId(sessionId);
                openProject(project.id);
              }}
              onDelete={() => removeProject(project.id)}
            />
          );
        })}
        <NewProjectCard
          disabled={projects.length >= 20}
          onNewProject={goToSetup}
        />
      </div>
      <button
        onClick={clearAllProjects}
        className="mt-4 text-[10px] text-v-dim hover:text-v-red transition-colors"
      >
        Clear all projects
      </button>
    </div>
  );
}
