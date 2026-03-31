import { useEffect } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ResourceSection } from "./ResourceSection";
import type { GlobalRepo, Skill, AgentDefinition } from "../../stores/types";

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
    globalRepos,
    skills,
    agentDefinitions,
    loadGlobalRepos,
    loadAgentDefinitions,
  } = useAppStore(
    useShallow((s) => ({
      globalRepos: s.globalRepos,
      skills: s.skills,
      agentDefinitions: s.agentDefinitions,
      loadGlobalRepos: s.loadGlobalRepos,
      loadAgentDefinitions: s.loadAgentDefinitions,
    })),
  );

  useEffect(() => {
    loadGlobalRepos();
    loadAgentDefinitions();
  }, [loadGlobalRepos, loadAgentDefinitions]);

  const activeSkillTokens = skills
    .filter((s) => checkedSkillIds.has(s.id))
    .reduce((sum, s) => sum + s.tokens, 0);

  const formatTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

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
        count={globalRepos.length}
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
        {globalRepos.length === 0 ? (
          <div className="border border-dashed border-v-border rounded-lg p-4 text-center">
            <p className="text-[11px] text-v-dim leading-relaxed">
              Drop a folder here, browse locally,<br />or paste a GitHub URL
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {globalRepos.map((repo) => (
              <RepoRow
                key={repo.id}
                repo={repo}
                checked={checkedRepoIds.has(repo.id)}
                onToggle={() => onToggleRepo(repo.id)}
              />
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

function RepoRow({ repo, checked, onToggle }: { repo: GlobalRepo; checked: boolean; onToggle: () => void }) {
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
        <div className="text-xs text-v-textHi truncate">{repo.name}</div>
        <div className="text-[10px] text-v-dim truncate">
          {repo.source === "local" ? "Local" : "GitHub"} · {repo.branch}
          {repo.language && ` · ${repo.language}`}
        </div>
      </div>
    </label>
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
