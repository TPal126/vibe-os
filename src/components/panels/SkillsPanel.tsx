import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { BookOpen, RefreshCw } from "lucide-react";
import { useAppStore } from "../../stores";
import { PanelHeader } from "../layout/PanelHeader";
import { Badge } from "../shared/Badge";
import { IconButton } from "../shared/IconButton";
import {
  formatTokens,
  TOKEN_BUDGET,
  getBudgetColor,
  getBudgetTextColor,
} from "../../lib/tokens";
import type { Skill } from "../../stores/types";

/* ── Category color map ─────────────────────────────────────────── */

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  data: { color: "text-v-cyan", bg: "bg-v-cyan/15" },
  ml: { color: "text-v-orange", bg: "bg-v-orange/15" },
  core: { color: "text-v-accent", bg: "bg-v-accent/15" },
  web: { color: "text-v-green", bg: "bg-v-green/15" },
  infra: { color: "text-v-red", bg: "bg-v-red/15" },
  viz: { color: "text-v-accentHi", bg: "bg-v-accentHi/15" },
};

/* ── SkillRow subcomponent ──────────────────────────────────────── */

function SkillRow({
  skill,
  onToggle,
}: {
  skill: Skill;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 hover:bg-v-surfaceHi/50 transition-colors cursor-pointer"
      onClick={() => onToggle(skill.id)}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={skill.active}
        onChange={() => onToggle(skill.id)}
        onClick={(e) => e.stopPropagation()}
        className="w-3.5 h-3.5 rounded border-v-border accent-v-accent shrink-0"
      />

      {/* Skill info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-v-textHi font-semibold truncate">
            {skill.label}
          </span>
          <Badge
            color={CATEGORY_COLORS[skill.category]?.color ?? "text-v-dim"}
            bg={CATEGORY_COLORS[skill.category]?.bg ?? "bg-v-border/50"}
          >
            {skill.category}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-v-dim">
            ~{formatTokens(skill.tokens)} tokens
          </span>
          {skill.source === "project" && (
            <Badge color="text-v-dim" bg="bg-v-border/50">
              project
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── SkillsPanel ────────────────────────────────────────────────── */

export function SkillsPanel() {
  const { skills, toggleSkill, discoverSkills } = useAppStore(
    useShallow((s) => ({
      skills: s.skills,
      toggleSkill: s.toggleSkill,
      discoverSkills: s.discoverSkills,
    })),
  );

  const totalActiveTokens = skills
    .filter((s) => s.active)
    .reduce((sum, s) => sum + s.tokens, 0);
  const budgetRatio = totalActiveTokens / TOKEN_BUDGET.softLimit;

  useEffect(() => {
    discoverSkills();
  }, [discoverSkills]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        title="SKILLS"
        icon={<BookOpen size={12} />}
        actions={
          <IconButton
            icon={<RefreshCw size={12} />}
            onClick={discoverSkills}
            title="Rediscover skills"
          />
        }
      />

      {/* Token Budget Bar */}
      <div className="px-3 py-2 border-b border-v-border bg-v-bgAlt">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-v-dim">Token Budget</span>
          <span
            className={`text-[10px] font-mono ${getBudgetTextColor(budgetRatio)}`}
          >
            ~{formatTokens(totalActiveTokens)} / {formatTokens(TOKEN_BUDGET.softLimit)}
          </span>
        </div>
        <div className="h-1.5 bg-v-border/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getBudgetColor(budgetRatio)}`}
            style={{ width: `${Math.min(budgetRatio * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Skills List */}
      <div className="flex-1 overflow-auto">
        {skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-v-dim">
            <BookOpen size={24} className="opacity-30 mb-2" />
            <span className="text-[11px]">No skills found</span>
            <span className="text-[10px] text-v-dim/50 mt-1">
              Add .md files to ~/.vibe-os/skills/
            </span>
          </div>
        ) : (
          <div className="divide-y divide-v-border/50">
            {skills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} onToggle={toggleSkill} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
