import type { SliceCreator, SkillSlice, Skill } from "../types";
import { commands, type SkillMeta } from "../../lib/tauri";

function skillMetaToSkill(meta: SkillMeta): Skill {
  return {
    id: meta.id,
    label: meta.label,
    category: meta.category as Skill["category"],
    active: false,
    tokens: meta.tokens,
    filePath: meta.file_path,
    source: meta.source as Skill["source"],
  };
}

export const createSkillSlice: SliceCreator<SkillSlice> = (set, get) => ({
  skills: [],

  toggleSkill: async (id: string) => {
    // Optimistic update
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, active: !s.active } : s,
      ),
    }));

    try {
      // Update session-linked skills
      const session = get().activeSession;
      if (session) {
        const activeIds = get()
          .skills.filter((s) => s.active)
          .map((s) => s.id);
        await commands.updateSessionSkills(activeIds);
      }

      // Log skill toggle to audit trail (fire-and-forget)
      const skill = get().skills.find((s) => s.id === id);
      if (skill) {
        const newActive = skill.active;
        commands
          .logAction(
            "SKILL_TOGGLE",
            `${newActive ? "Activated" : "Deactivated"} skill: ${skill.label}`,
            "user",
            JSON.stringify({ skillId: skill.id, active: newActive }),
          )
          .catch(() => {});
      }

      // Recompose prompt with updated skill context
      await get().recompose();
    } catch (err) {
      console.error("Failed to toggle skill:", err);
    }
  },

  discoverSkills: async () => {
    try {
      const activeRepoPaths = get()
        .repos.filter((r) => r.active)
        .map((r) => r.localPath);
      const workspacePath = get().activeWorkspace?.path ?? undefined;
      const metas = await commands.discoverSkills(activeRepoPaths, workspacePath);
      const skills = metas.map(skillMetaToSkill);
      set({ skills });
    } catch (err) {
      console.error("Failed to discover skills:", err);
    }
  },
});
