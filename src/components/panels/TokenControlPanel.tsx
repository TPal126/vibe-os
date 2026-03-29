import { useEffect, useState, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { Gauge, Trash2 } from "lucide-react";
import { useAppStore } from "../../stores";
import { PanelHeader } from "../layout/PanelHeader";
import {
  formatTokens,
  getUsageRatio,
  getWarningLevel,
  getWarningColors,
} from "../../lib/tokens";
import type { Skill, Repo, TokenBudget } from "../../stores/types";

/* -- Editable Budget Input ------------------------------------------- */

function BudgetInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | undefined;
  onChange: (val: number) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");

  // Sync external value changes
  useEffect(() => {
    setDraft(value?.toString() ?? "");
  }, [value]);

  const handleBlur = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onChange(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder ?? "No limit"}
      className="w-[72px] px-1.5 py-0.5 text-[10px] font-mono text-v-textHi bg-v-surface border border-v-border rounded text-right focus:outline-none focus:border-v-accent transition-colors"
    />
  );
}

/* -- Usage Bar ------------------------------------------------------- */

function UsageBar({
  current,
  max,
  warningThreshold,
}: {
  current: number;
  max: number;
  warningThreshold?: number;
}) {
  const ratio = getUsageRatio(current, max);
  const level = getWarningLevel(ratio, warningThreshold);
  const { bar, text } = getWarningColors(level);
  const pct = Math.min(ratio * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-v-border/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[9px] font-mono shrink-0 ${text}`}>
        ~{formatTokens(current)}/{formatTokens(max)}
      </span>
    </div>
  );
}

/* -- Session Budget Section ------------------------------------------ */

function SessionBudgetSection({
  budget,
  totalTokens,
  onSet,
  onDelete,
}: {
  budget: TokenBudget | undefined;
  totalTokens: number;
  onSet: (max: number) => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-3 py-2 border-b border-v-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-v-dim uppercase tracking-wide">
          Session Budget
        </span>
        <div className="flex items-center gap-1">
          <BudgetInput
            value={budget?.maxTokens}
            onChange={onSet}
            placeholder="20000"
          />
          {budget && (
            <button
              onClick={onDelete}
              className="p-0.5 text-v-dim hover:text-v-red transition-colors"
              title="Remove session budget"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>
      {budget ? (
        <UsageBar
          current={totalTokens}
          max={budget.maxTokens}
          warningThreshold={budget.warningThreshold}
        />
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-v-border/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-v-accent transition-all duration-300"
              style={{
                width: `${Math.min((totalTokens / 20000) * 100, 100)}%`,
              }}
            />
          </div>
          <span className="text-[9px] font-mono text-v-dim shrink-0">
            ~{formatTokens(totalTokens)} (no limit)
          </span>
        </div>
      )}
    </div>
  );
}

/* -- Per-Skill Budget Row -------------------------------------------- */

function SkillBudgetRow({
  skill,
  budget,
  onSet,
  onDelete,
}: {
  skill: Skill;
  budget: TokenBudget | undefined;
  onSet: (max: number) => void;
  onDelete: () => void;
}) {
  const ratio = budget ? getUsageRatio(skill.tokens, budget.maxTokens) : 0;
  const level = budget
    ? getWarningLevel(ratio, budget.warningThreshold)
    : "normal";
  const { text } = getWarningColors(level);

  return (
    <div className="px-3 py-1.5 hover:bg-v-surface/50 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="flex-1 min-w-0 text-[11px] text-v-textHi truncate">
          {skill.label}
        </span>
        <span
          className={`text-[9px] font-mono shrink-0 ${budget ? text : "text-v-dim"}`}
        >
          ~{formatTokens(skill.tokens)}
        </span>
        <BudgetInput value={budget?.maxTokens} onChange={onSet} />
        {budget && (
          <button
            onClick={onDelete}
            className="p-0.5 text-v-dim hover:text-v-red transition-colors"
            title="Remove skill budget"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>
      {budget && (
        <UsageBar
          current={skill.tokens}
          max={budget.maxTokens}
          warningThreshold={budget.warningThreshold}
        />
      )}
    </div>
  );
}

/* -- Per-Repo Budget Row --------------------------------------------- */

function RepoBudgetRow({
  repo,
  budget,
  onSet,
  onDelete,
}: {
  repo: Repo;
  budget: TokenBudget | undefined;
  onSet: (max: number) => void;
  onDelete: () => void;
}) {
  // Estimate repo tokens from indexSummary length
  const repoTokens = repo.indexSummary
    ? Math.round(repo.indexSummary.length / 3.5)
    : 0;
  const ratio = budget ? getUsageRatio(repoTokens, budget.maxTokens) : 0;
  const level = budget
    ? getWarningLevel(ratio, budget.warningThreshold)
    : "normal";
  const { text } = getWarningColors(level);

  return (
    <div className="px-3 py-1.5 hover:bg-v-surface/50 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="flex-1 min-w-0 text-[11px] text-v-textHi truncate">
          {repo.name}
        </span>
        <span
          className={`text-[9px] font-mono shrink-0 ${budget ? text : "text-v-dim"}`}
        >
          ~{formatTokens(repoTokens)}
        </span>
        <BudgetInput value={budget?.maxTokens} onChange={onSet} />
        {budget && (
          <button
            onClick={onDelete}
            className="p-0.5 text-v-dim hover:text-v-red transition-colors"
            title="Remove repo budget"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>
      {budget && (
        <UsageBar
          current={repoTokens}
          max={budget.maxTokens}
          warningThreshold={budget.warningThreshold}
        />
      )}
    </div>
  );
}

/* -- TokenControlPanel ----------------------------------------------- */

export function TokenControlPanel() {
  const {
    skills,
    repos,
    tokenBudgets,
    tokenBudgetsLoading,
    composedPrompt,
    loadTokenBudgets,
    setTokenBudget,
    deleteTokenBudget,
    getSkillBudget,
    getRepoBudget,
    getSessionBudget,
  } = useAppStore(
    useShallow((s) => ({
      skills: s.skills,
      repos: s.repos,
      tokenBudgets: s.tokenBudgets,
      tokenBudgetsLoading: s.tokenBudgetsLoading,
      composedPrompt: s.composedPrompt,
      loadTokenBudgets: s.loadTokenBudgets,
      setTokenBudget: s.setTokenBudget,
      deleteTokenBudget: s.deleteTokenBudget,
      getSkillBudget: s.getSkillBudget,
      getRepoBudget: s.getRepoBudget,
      getSessionBudget: s.getSessionBudget,
    })),
  );

  useEffect(() => {
    loadTokenBudgets();
  }, [loadTokenBudgets]);

  const totalTokens = composedPrompt?.totalTokens ?? 0;
  const sessionBudget = getSessionBudget();
  const activeSkills = skills.filter((s) => s.active);
  const activeRepos = repos.filter((r) => r.active);

  // Count items over warning threshold for tab badge
  const overWarningCount = tokenBudgets.filter((b) => {
    if (b.scopeType === "session") {
      return getUsageRatio(totalTokens, b.maxTokens) >= b.warningThreshold;
    }
    if (b.scopeType === "skill") {
      const skill = skills.find((s) => s.id === b.scopeId);
      if (!skill) return false;
      return getUsageRatio(skill.tokens, b.maxTokens) >= b.warningThreshold;
    }
    if (b.scopeType === "repo") {
      const repo = repos.find((r) => r.id === b.scopeId);
      if (!repo || !repo.indexSummary) return false;
      const tokens = Math.round(repo.indexSummary.length / 3.5);
      return getUsageRatio(tokens, b.maxTokens) >= b.warningThreshold;
    }
    return false;
  }).length;

  const handleSetSessionBudget = useCallback(
    (max: number) => setTokenBudget("session", "global", max),
    [setTokenBudget],
  );

  const handleDeleteSessionBudget = useCallback(() => {
    if (sessionBudget) deleteTokenBudget(sessionBudget.id);
  }, [sessionBudget, deleteTokenBudget]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        title="TOKEN CONTROL"
        icon={<Gauge size={12} />}
        actions={
          overWarningCount > 0 ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-v-red bg-v-red/15">
              {overWarningCount} over
            </span>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto">
        {tokenBudgetsLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">Loading budgets...</p>
          </div>
        ) : (
          <>
            {/* Session Budget */}
            <SessionBudgetSection
              budget={sessionBudget}
              totalTokens={totalTokens}
              onSet={handleSetSessionBudget}
              onDelete={handleDeleteSessionBudget}
            />

            {/* Per-Skill Budgets */}
            <div className="border-b border-v-border">
              <div className="px-3 py-1.5 bg-v-bgAlt">
                <span className="text-[10px] font-mono text-v-dim uppercase tracking-wide">
                  Skill Budgets
                </span>
                <span className="text-[9px] text-v-dim ml-1.5">
                  ({activeSkills.length} active)
                </span>
              </div>
              {activeSkills.length === 0 ? (
                <div className="px-3 py-2">
                  <p className="text-[10px] text-v-dim">No active skills</p>
                </div>
              ) : (
                <div className="divide-y divide-v-border/30">
                  {activeSkills.map((skill) => (
                    <SkillBudgetRow
                      key={skill.id}
                      skill={skill}
                      budget={getSkillBudget(skill.id)}
                      onSet={(max) => setTokenBudget("skill", skill.id, max)}
                      onDelete={() => {
                        const b = getSkillBudget(skill.id);
                        if (b) deleteTokenBudget(b.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Per-Repo Budgets */}
            <div>
              <div className="px-3 py-1.5 bg-v-bgAlt">
                <span className="text-[10px] font-mono text-v-dim uppercase tracking-wide">
                  Repo Budgets
                </span>
                <span className="text-[9px] text-v-dim ml-1.5">
                  ({activeRepos.length} active)
                </span>
              </div>
              {activeRepos.length === 0 ? (
                <div className="px-3 py-2">
                  <p className="text-[10px] text-v-dim">No active repos</p>
                </div>
              ) : (
                <div className="divide-y divide-v-border/30">
                  {activeRepos.map((repo) => (
                    <RepoBudgetRow
                      key={repo.id}
                      repo={repo}
                      budget={getRepoBudget(repo.id)}
                      onSet={(max) => setTokenBudget("repo", repo.id, max)}
                      onDelete={() => {
                        const b = getRepoBudget(repo.id);
                        if (b) deleteTokenBudget(b.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
