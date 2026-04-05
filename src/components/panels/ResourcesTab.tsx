import { useState, useMemo } from "react";
import { useAppStore } from "../../stores";
import { useShallow } from "zustand/react/shallow";
import { ResourceCatalog } from "../home/ResourceCatalog";
import { RepoBrowseModal } from "../home/RepoBrowseModal";
import { RepoGithubModal } from "../home/RepoGithubModal";

/**
 * Thin wrapper that bridges the store's `active` booleans on repos/skills/agents
 * to the controlled Set-based state that ResourceCatalog expects.
 */
export function ResourcesTab() {
  const { repos, skills, agentDefinitions, toggleRepo, toggleSkill, toggleAgentDefinition, addRepoLocal, addRepoGithub } =
    useAppStore(
      useShallow((s) => ({
        repos: s.repos,
        skills: s.skills,
        agentDefinitions: s.agentDefinitions,
        toggleRepo: s.toggleRepo,
        toggleSkill: s.toggleSkill,
        toggleAgentDefinition: s.toggleAgentDefinition,
        addRepoLocal: s.addRepoLocal,
        addRepoGithub: s.addRepoGithub,
      })),
    );

  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);

  const checkedRepoIds = useMemo(
    () => new Set(repos.filter((r) => r.active).map((r) => r.id)),
    [repos],
  );

  const checkedSkillIds = useMemo(
    () => new Set(skills.filter((s) => s.active).map((s) => s.id)),
    [skills],
  );

  const checkedAgentNames = useMemo(
    () => new Set(agentDefinitions.filter((a) => a.active).map((a) => a.name)),
    [agentDefinitions],
  );

  return (
    <>
      <ResourceCatalog
        checkedRepoIds={checkedRepoIds}
        checkedSkillIds={checkedSkillIds}
        checkedAgentNames={checkedAgentNames}
        onToggleRepo={toggleRepo}
        onToggleSkill={toggleSkill}
        onToggleAgent={toggleAgentDefinition}
        onAddReposLocal={() => setShowBrowseModal(true)}
        onAddReposGithub={() => setShowGithubModal(true)}
      />

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
    </>
  );
}
