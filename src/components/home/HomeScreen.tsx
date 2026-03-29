import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ProjectCard } from "./ProjectCard";
import { NewProjectCard } from "./NewProjectCard";

export function HomeScreen() {
  const { projects, claudeSessions, openProject } = useAppStore(
    useShallow((s) => ({
      projects: s.projects,
      claudeSessions: s.claudeSessions,
      openProject: s.openProject,
    })),
  );

  const handleCardClick = (id: string) => {
    openProject(id);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {projects.length === 0 && (
        <p className="text-v-dim text-sm mb-4">Create your first project</p>
      )}
      <div className="grid grid-cols-3 gap-4 max-w-[720px] w-full">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            session={claudeSessions.get(project.claudeSessionId)}
            onClick={() => handleCardClick(project.id)}
          />
        ))}
        <NewProjectCard
          disabled={projects.length >= 5}
          onCreateProject={() => {}}
        />
      </div>
    </div>
  );
}
