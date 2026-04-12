import { useState, useMemo } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ResourceCatalog } from "./ResourceCatalog";
import { RepoBrowseModal } from "./RepoBrowseModal";
import { RepoGithubModal } from "./RepoGithubModal";

export function ProjectSetupView() {
  const {
    repos,
    goHome,
    addProject,
    createWorkspace,
    createSessionLocal,
    setActiveSessionId,
    toggleRepo,
    addRepoLocal,
    addRepoGithub,
  } = useAppStore(
    useShallow((s) => ({
      repos: s.repos,
      goHome: s.goHome,
      addProject: s.addProject,
      createWorkspace: s.createWorkspace,
      createSessionLocal: s.createSessionLocal,
      setActiveSessionId: s.setActiveSessionId,
      toggleRepo: s.toggleRepo,
      addRepoLocal: s.addRepoLocal,
      addRepoGithub: s.addRepoGithub,
    })),
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Derive checked repo IDs from store's active flags
  const checkedRepoIds = useMemo(
    () => new Set(repos.filter((r) => r.active).map((r) => r.id)),
    [repos],
  );

  const [checkedSkillIds, setCheckedSkillIds] = useState<Set<string>>(new Set());
  const [checkedAgentNames, setCheckedAgentNames] = useState<Set<string>>(new Set());

  // Modal state for repo adding
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);

  const toggleSet = <T,>(prev: Set<T>, item: T): Set<T> => {
    const next = new Set(prev);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    return next;
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    const safeName = trimmed
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!safeName) {
      setError("Invalid project name");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createWorkspace(safeName);
      const workspace = useAppStore.getState().activeWorkspace;
      if (!workspace) throw new Error("Workspace creation failed");

      const sessionId = crypto.randomUUID();
      createSessionLocal(sessionId, trimmed);

      // Create project
      addProject(trimmed, workspace.path, sessionId);

      // Update project with linked resources and description
      const projects = useAppStore.getState().projects;
      const newProject = projects[projects.length - 1];
      if (newProject) {
        const { saveProjects } = useAppStore.getState();
        const currentRepos = useAppStore.getState().repos;
        const linkedRepoIds = currentRepos.filter((r) => r.active).map((r) => r.id);
        const updatedProjects = projects.map((p) =>
          p.id === newProject.id
            ? {
                ...p,
                summary: description,
                linkedRepoIds,
                linkedSkillIds: Array.from(checkedSkillIds),
                linkedAgentNames: Array.from(checkedAgentNames),
              }
            : p,
        );
        useAppStore.setState({ projects: updatedProjects });
        saveProjects();
      }

      setActiveSessionId(sessionId);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex h-full">
      {/* Left: Project config */}
      <div className="flex-1 flex flex-col p-8 max-w-[480px]">
        <div className="text-[11px] uppercase tracking-wider text-v-dim font-semibold mb-6">
          New Project
        </div>

        <div className="mb-5">
          <label className="text-xs text-v-text mb-1.5 block">Project name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder="my-project"
            disabled={submitting}
            autoFocus
            className="w-full bg-v-surface border border-v-border rounded-lg px-3 py-2.5 text-sm text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent transition-colors disabled:opacity-50"
          />
        </div>

        <div className="mb-5">
          <label className="text-xs text-v-text mb-1.5 block">
            Description <span className="text-v-dim">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            disabled={submitting}
            rows={3}
            className="w-full bg-v-surface border border-v-border rounded-lg px-3 py-2.5 text-[13px] text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent transition-colors resize-none disabled:opacity-50"
          />
        </div>

        {error && (
          <p className="text-v-red text-[11px] mb-4">{error}</p>
        )}

        <div className="flex-1" />

        <div className="flex gap-3">
          <button
            onClick={goHome}
            disabled={submitting}
            className="px-5 py-2.5 bg-v-surface border border-v-border rounded-lg text-sm text-v-text hover:border-v-borderHi transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting || !name.trim()}
            className="flex-1 px-5 py-2.5 bg-v-accent text-white rounded-lg text-sm font-medium hover:bg-v-accentHi transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>

      {/* Right: Resource catalog */}
      <div className="w-[300px] border-l border-v-border bg-v-bgAlt">
        <ResourceCatalog
          checkedRepoIds={checkedRepoIds}
          checkedSkillIds={checkedSkillIds}
          checkedAgentNames={checkedAgentNames}
          onToggleRepo={(id) => toggleRepo(id)}
          onToggleSkill={(id) => setCheckedSkillIds((prev) => toggleSet(prev, id))}
          onToggleAgent={(agentName) => setCheckedAgentNames((prev) => toggleSet(prev, agentName))}
          onAddReposLocal={() => setShowBrowseModal(true)}
          onAddReposGithub={() => setShowGithubModal(true)}
        />
      </div>

      {showBrowseModal && (
        <RepoBrowseModal
          onAdd={(paths) => {
            paths.forEach((p) => addRepoLocal(p));
          }}
          onClose={() => setShowBrowseModal(false)}
        />
      )}
      {showGithubModal && (
        <RepoGithubModal
          onAdd={(gitUrls) => {
            gitUrls.forEach((url) => addRepoGithub(url));
          }}
          onClose={() => setShowGithubModal(false)}
        />
      )}
    </div>
  );
}
