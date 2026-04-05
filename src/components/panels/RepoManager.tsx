import { useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { FolderGit2, Plus, GitBranch, FileText } from "lucide-react";
import { useAppStore } from "../../stores";
import { PanelHeader } from "../layout/PanelHeader";
import { Badge } from "../shared/Badge";
import { IconButton } from "../shared/IconButton";
import { AddRepoModal } from "../modals/AddRepoModal";
import type { Repo } from "../../stores/types";

/* ── Language color helpers ─────────────────────────────────────── */

function languageColor(lang: string): string {
  switch (lang) {
    case "Python":
      return "text-v-green";
    case "TypeScript":
      return "text-v-accent";
    case "JavaScript":
      return "text-v-orange";
    case "Rust":
      return "text-v-red";
    default:
      return "text-v-dim";
  }
}

function languageBg(lang: string): string {
  switch (lang) {
    case "Python":
      return "bg-v-green/15";
    case "TypeScript":
      return "bg-v-accent/15";
    case "JavaScript":
      return "bg-v-orange/15";
    case "Rust":
      return "bg-v-red/15";
    default:
      return "bg-v-border/50";
  }
}

/* ── RepoRow subcomponent ───────────────────────────────────────── */

function RepoRow({
  repo,
  onToggle,
}: {
  repo: Repo;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 hover:bg-v-surfaceHi/50 transition-colors cursor-pointer"
      onClick={() => onToggle(repo.id)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={repo.active}
        onChange={() => onToggle(repo.id)}
        onClick={(e) => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded border-v-border accent-v-accent shrink-0"
      />

      {/* Repo info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-v-textHi font-semibold truncate">
            {repo.name}
          </span>
          <Badge color="text-v-dim" bg="bg-v-border/50">
            {repo.source}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-v-dim flex items-center gap-1">
            <GitBranch size={9} /> {repo.branch}
          </span>
          <span className="text-[10px] text-v-dim flex items-center gap-1">
            <FileText size={9} /> {repo.fileCount}
          </span>
        </div>
      </div>

      {/* Language badge */}
      <Badge color={languageColor(repo.language)} bg={languageBg(repo.language)}>
        {repo.language}
      </Badge>
    </div>
  );
}

/* ── RepoManager panel ──────────────────────────────────────────── */

export function RepoManager() {
  const [showAddModal, setShowAddModal] = useState(false);

  const { repos, toggleRepo, addRepoGithub, loadRepos } = useAppStore(
    useShallow((s) => ({
      repos: s.repos,
      toggleRepo: s.toggleRepo,
      addRepoGithub: s.addRepoGithub,
      loadRepos: s.loadRepos,
    })),
  );

  useEffect(() => {
    if (repos.length === 0) {
      loadRepos();
    }
  }, [loadRepos, repos.length]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        title="REPOS"
        icon={<FolderGit2 size={12} />}
        actions={
          <IconButton
            icon={<Plus size={13} />}
            onClick={() => setShowAddModal(true)}
            title="Add repository"
          />
        }
      />
      <div className="flex-1 overflow-auto">
        {repos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-v-dim">
            <FolderGit2 size={24} className="opacity-30 mb-2" />
            <span className="text-[11px]">No repositories</span>
            <span className="text-[10px] text-v-dim/50 mt-1">
              Click + to add a repo
            </span>
          </div>
        ) : (
          <div className="divide-y divide-v-border/50">
            {repos.map((repo) => (
              <RepoRow key={repo.id} repo={repo} onToggle={toggleRepo} />
            ))}
          </div>
        )}
      </div>
      <AddRepoModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={addRepoGithub}
      />
    </div>
  );
}
