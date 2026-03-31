import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { EnhancedProjectCard } from "./EnhancedProjectCard";
import { NewProjectCard } from "./NewProjectCard";
import type { Project, ClaudeSessionState } from "../../stores/types";

export function HomeScreen() {
  const {
    projects,
    claudeSessions,
    openProject,
    addProject,
    createWorkspace,
    createClaudeSessionLocal,
    setActiveClaudeSessionId,
    openWorkspace,
  } = useAppStore(
    useShallow((s) => ({
      projects: s.projects,
      claudeSessions: s.claudeSessions,
      openProject: s.openProject,
      addProject: s.addProject,
      createWorkspace: s.createWorkspace,
      createClaudeSessionLocal: s.createClaudeSessionLocal,
      setActiveClaudeSessionId: s.setActiveClaudeSessionId,
      openWorkspace: s.openWorkspace,
    })),
  );

  const handleCreateProject = async (name: string): Promise<string | null> => {
    try {
      // Sanitize name for filesystem (display name preserved as-is)
      const safeName = name
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (!safeName) return "Invalid project name";

      // 1. Scaffold workspace
      await createWorkspace(safeName);
      const workspace = useAppStore.getState().activeWorkspace;
      if (!workspace) return "Workspace creation failed";

      // 2. Create Claude session
      const sessionId = crypto.randomUUID();
      createClaudeSessionLocal(sessionId, name);

      // 3. Register project + navigate (use original name for display)
      addProject(name, workspace.path, sessionId);

      // 4. Activate session for chat
      setActiveClaudeSessionId(sessionId);
      return null;
    } catch (err) {
      console.error("Failed to create project:", err);
      return String(err);
    }
  };

  const handleOpenProject = async (project: Project) => {
    // Navigate immediately (UI feels instant)
    openProject(project.id);
    setActiveClaudeSessionId(project.claudeSessionId);

    // Load workspace context in background
    try {
      await openWorkspace(project.workspacePath);
    } catch (err) {
      console.warn("Workspace load failed, chat still works:", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {projects.length === 0 && (
        <p className="text-v-dim text-sm mb-4">Create your first project</p>
      )}
      <div className="grid grid-cols-3 gap-4 max-w-[720px] w-full">
        {projects.map((project) => {
          // Build a Map of all sessions associated with this project.
          // The primary session is always included; any additional sessions
          // that share the same project (by convention name prefix, etc.)
          // would be added here in future. For now we include the primary
          // session and any orphaned sessions that reference this project.
          const projectSessions = new Map<string, ClaudeSessionState>();
          const primarySession = claudeSessions.get(project.claudeSessionId);
          if (primarySession) {
            projectSessions.set(primarySession.id, primarySession);
          }
          // Include additional sessions beyond the primary one
          claudeSessions.forEach((session, id) => {
            if (id !== project.claudeSessionId && !projectSessions.has(id)) {
              // Only include sessions that belong to this project
              // (currently there is no explicit project<->session FK beyond claudeSessionId,
              // so we only surface the primary session for now)
            }
          });

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
            />
          );
        })}
        <NewProjectCard
          disabled={projects.length >= 5}
          onCreateProject={handleCreateProject}
        />
      </div>
    </div>
  );
}
