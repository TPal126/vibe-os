import { useEffect, useState } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ResourceSection } from "./ResourceSection";
import { RepoDropZone } from "./RepoDropZone";
import { RefreshCw, GitBranch, X } from "lucide-react";
import { commands } from "../../lib/tauri";
import type { Repo, Skill, AgentDefinition } from "../../stores/types";

interface ResourceCatalogProps {
  checkedRepoIds: Set<string>;
  checkedSkillIds: Set<string>;
  checkedAgentNames: Set<string>;
  onToggleRepo: (id: string) => void;
  onToggleSkill: (id: string) => void;
  onToggleAgent: (name: string) => void;
  onAddReposLocal: () => void;
  onAddReposGithub: () => void;
}

export function ResourceCatalog({
  checkedRepoIds,
  checkedSkillIds,
  checkedAgentNames,
  onToggleRepo,
  onToggleSkill,
  onToggleAgent,
  onAddReposLocal,
  onAddReposGithub,
}: ResourceCatalogProps) {
  const {
    repos,
    skills,
    agentDefinitions,
    loadRepos,
    loadAgentDefinitions,
    addRepoLocal,
    addBranch,
    removeRepo,
  } = useAppStore(
    useShallow((s) => ({
      repos: s.repos,
      skills: s.skills,
      agentDefinitions: s.agentDefinitions,
      loadRepos: s.loadRepos,
      loadAgentDefinitions: s.loadAgentDefinitions,
      addRepoLocal: s.addRepoLocal,
      addBranch: s.addBranch,
      removeRepo: s.removeRepo,
    })),
  );

  useEffect(() => {
    loadRepos();
    loadAgentDefinitions();
  }, [loadRepos, loadAgentDefinitions]);

  const activeSkillTokens = skills
    .filter((s) => checkedSkillIds.has(s.id))
    .reduce((sum, s) => sum + s.tokens, 0);

  const formatTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

  // Group: parents first, children indented under parent
  const parentRepos = repos.filter((r) => !r.parentId);
  const childrenOf = (parentId: string) => repos.filter((r) => r.parentId === parentId);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-v-dim font-semibold mb-1">
        Resource Catalog
      </div>
      <div className="text-[10px] text-v-dim mb-4">
        Check resources to include in this project
      </div>

      {/* Repos */}
      <ResourceSection
        title="Repos"
        count={repos.length}
        actions={
          <div className="flex gap-1">
            <button
              onClick={onAddReposLocal}
              className="text-[9px] text-v-dim border border-v-border px-1.5 py-0.5 rounded hover:border-v-borderHi transition-colors"
            >
              Browse
            </button>
            <button
              onClick={onAddReposGithub}
              className="text-[9px] text-v-dim border border-v-border px-1.5 py-0.5 rounded hover:border-v-borderHi transition-colors"
            >
              GitHub
            </button>
          </div>
        }
      >
        <RepoDropZone
          onDrop={(paths) => {
            paths.forEach((p) => addRepoLocal(p));
          }}
        />
        {repos.length === 0 ? (
          <div className="text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              No repos yet — browse, paste a GitHub URL, or drop folders above
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {parentRepos.map((repo) => (
              <div key={repo.id}>
                <RepoRow
                  repo={repo}
                  checked={checkedRepoIds.has(repo.id)}
                  onToggle={() => onToggleRepo(repo.id)}
                  onRemove={() => removeRepo(repo.id)}
                  onAddBranch={(branch) => addBranch(repo.id, branch)}
                />
                {childrenOf(repo.id).map((child) => (
                  <BranchRow
                    key={child.id}
                    repo={child}
                    checked={checkedRepoIds.has(child.id)}
                    onToggle={() => onToggleRepo(child.id)}
                    onRemove={() => removeRepo(child.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </ResourceSection>

      {/* Skills */}
      <ResourceSection
        title="Skills"
        count={skills.length}
        badge={activeSkillTokens > 0 ? `${formatTokens(activeSkillTokens)} tokens` : undefined}
      >
        {skills.length === 0 ? (
          <div className="border border-dashed border-v-border rounded-lg p-4 text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              Add .md files to<br />~/.vibe-os/skills/
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {skills.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                checked={checkedSkillIds.has(skill.id)}
                onToggle={() => onToggleSkill(skill.id)}
              />
            ))}
          </div>
        )}
      </ResourceSection>

      {/* Agents */}
      <ResourceSection
        title="Agents"
        count={agentDefinitions.length}
        badge="~/.vibe-os/agents/"
      >
        {agentDefinitions.length === 0 ? (
          <div className="border border-dashed border-v-border rounded-lg p-4 text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              Agents created during sessions<br />will appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {agentDefinitions.map((agent) => (
              <AgentRow
                key={agent.name}
                agent={agent}
                checked={checkedAgentNames.has(agent.name)}
                onToggle={() => onToggleAgent(agent.name)}
              />
            ))}
          </div>
        )}
      </ResourceSection>
    </div>
  );
}

function RepoRow({
  repo,
  checked,
  onToggle,
  onRemove,
  onAddBranch,
}: {
  repo: Repo;
  checked: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onAddBranch: (branch: string) => void;
}) {
  const [pathMissing, setPathMissing] = useState<boolean | null>(null);
  const [showBranchInput, setShowBranchInput] = useState(false);
  const [branchInput, setBranchInput] = useState("");
  const { refreshRepoBranch } = useAppStore(
    useShallow((s) => ({ refreshRepoBranch: s.refreshRepoBranch })),
  );

  useEffect(() => {
    let cancelled = false;
    if (repo.localPath) {
      commands
        .readFile(repo.localPath + "/.git/HEAD")
        .then(() => { if (!cancelled) setPathMissing(false); })
        .catch(() => { if (!cancelled) setPathMissing(true); });
    }
    return () => { cancelled = true; };
  }, [repo.localPath]);

  const isMissing = pathMissing === true;

  return (
    <div className="flex flex-col">
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
          isMissing
            ? "bg-v-surface border border-v-border opacity-60"
            : checked
            ? "bg-v-accent/8 border border-v-accent/20"
            : "bg-v-surface border border-v-border"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={isMissing}
          className="accent-v-accent"
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-v-textHi truncate">{repo.name}</div>
          <div className="text-[10px] text-v-dim truncate">
            {repo.source === "local" ? "Local" : "GitHub"} · {repo.branch}
            {repo.language && ` · ${repo.language}`}
          </div>
        </div>
        {isMissing && (
          <span className="text-[9px] bg-v-orangeDim text-v-orange px-1.5 py-0.5 rounded">
            missing
          </span>
        )}
        {isMissing ? (
          <button
            onClick={onRemove}
            className="text-v-dim hover:text-v-red transition-colors"
            title="Remove missing repo"
          >
            <X size={12} />
          </button>
        ) : (
          <>
            {repo.source === "local" && (
              <button
                onClick={() => refreshRepoBranch(repo.id)}
                className="text-v-dim hover:text-v-text transition-colors"
                title="Refresh branch"
              >
                <RefreshCw size={11} />
              </button>
            )}
            {repo.source === "github" && (
              <button
                onClick={() => setShowBranchInput((v) => !v)}
                className="text-[9px] text-v-dim border border-v-border px-1 py-0.5 rounded hover:border-v-borderHi transition-colors"
                title="Add branch worktree"
              >
                + Branch
              </button>
            )}
            <button
              onClick={onRemove}
              className="text-v-dim hover:text-v-red transition-colors"
              title="Remove repo"
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>
      {showBranchInput && (
        <div className="flex gap-1 mt-1 pl-6">
          <input
            type="text"
            value={branchInput}
            onChange={(e) => setBranchInput(e.target.value)}
            placeholder="branch name"
            className="flex-1 bg-v-surface border border-v-border rounded px-2 py-1 text-[10px] text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent"
            onKeyDown={(e) => {
              if (e.key === "Enter" && branchInput.trim()) {
                onAddBranch(branchInput.trim());
                setBranchInput("");
                setShowBranchInput(false);
              } else if (e.key === "Escape") {
                setShowBranchInput(false);
              }
            }}
          />
          <button
            onClick={() => {
              if (branchInput.trim()) {
                onAddBranch(branchInput.trim());
                setBranchInput("");
                setShowBranchInput(false);
              }
            }}
            className="text-[9px] px-2 py-1 bg-v-accent text-white rounded hover:bg-v-accentHi transition-colors"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function BranchRow({
  repo,
  checked,
  onToggle,
  onRemove,
}: {
  repo: Repo;
  checked: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md ml-4 mt-0.5 transition-colors ${
        checked
          ? "bg-v-accent/8 border border-v-accent/20"
          : "bg-v-surface border border-v-border"
      }`}
    >
      <GitBranch size={10} className="text-v-dim shrink-0" />
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-v-accent"
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-v-textHi truncate">{repo.branch}</div>
        <div className="text-[10px] text-v-dim truncate">{repo.name}</div>
      </div>
      <button
        onClick={onRemove}
        className="text-v-dim hover:text-v-red transition-colors"
        title="Remove branch worktree"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function SkillRow({ skill, checked, onToggle }: { skill: Skill; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        checked ? "bg-v-accent/8 border border-v-accent/20" : "bg-v-surface border border-v-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-v-accent"
      />
      <div className="min-w-0">
        <div className="text-xs text-v-textHi truncate">{skill.label}</div>
        <div className="text-[10px] text-v-dim">
          {skill.category} · {skill.tokens} tokens
        </div>
      </div>
    </label>
  );
}

function AgentRow({ agent, checked, onToggle }: { agent: AgentDefinition; checked: boolean; onToggle: () => void }) {
  return (
    <label
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        checked ? "bg-v-accent/8 border border-v-accent/20" : "bg-v-surface border border-v-border"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-v-accent"
      />
      <div className="min-w-0">
        <div className="text-xs text-v-textHi truncate">{agent.name}</div>
        <div className="text-[10px] text-v-dim truncate">{agent.description}</div>
      </div>
    </label>
  );
}
