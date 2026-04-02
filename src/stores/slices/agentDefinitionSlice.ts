import type { SliceCreator, AgentDefinitionSlice } from "../types";
import { commands } from "../../lib/tauri";

export const createAgentDefinitionSlice: SliceCreator<AgentDefinitionSlice> = (set, get) => ({
  agentDefinitions: [],
  agentDefinitionsLoading: false,

  loadAgentDefinitions: async () => {
    set({ agentDefinitionsLoading: true });
    try {
      const raw = await commands.loadAgentDefinitions();
      const defs = raw.map((r) => ({
        name: r.name,
        description: r.description,
        systemPrompt: r.system_prompt,
        tools: r.tools,
        createdAt: r.created_at,
        sourceSessionId: r.source_session_id,
        active: false,
        model: r.model ?? null,
        permissionMode: r.permission_mode ?? null,
        disallowedTools: r.disallowed_tools ?? [],
        maxTurns: r.max_turns ?? null,
        background: r.background ?? false,
        isolation: r.isolation ?? null,
        memory: r.memory ?? null,
        skills: r.skills ?? [],
        color: r.color ?? null,
      }));
      set({ agentDefinitions: defs });
    } catch (err) {
      console.warn("[vibe-os] Failed to load agent definitions:", err);
    } finally {
      set({ agentDefinitionsLoading: false });
    }
  },

  saveAgentDefinition: async (name, description, systemPrompt, tools, sourceSessionId, opts) => {
    await commands.saveAgentDefinition(name, description, systemPrompt, tools, sourceSessionId, opts);
    const def = {
      name,
      description,
      systemPrompt,
      tools,
      createdAt: new Date().toISOString().slice(0, 10),
      sourceSessionId,
      active: false,
      model: opts?.model ?? null,
      permissionMode: opts?.permissionMode ?? null,
      disallowedTools: opts?.disallowedTools ?? [],
      maxTurns: opts?.maxTurns ?? null,
      background: opts?.background ?? false,
      isolation: opts?.isolation ?? null,
      memory: opts?.memory ?? null,
      skills: opts?.skills ?? [],
      color: opts?.color ?? null,
    };
    set({ agentDefinitions: [...get().agentDefinitions, def] });
  },

  removeAgentDefinition: async (name) => {
    await commands.removeAgentDefinition(name);
    set({ agentDefinitions: get().agentDefinitions.filter((a) => a.name !== name) });
  },

  toggleAgentDefinition: (name) => {
    set({
      agentDefinitions: get().agentDefinitions.map((a) =>
        a.name === name ? { ...a, active: !a.active } : a,
      ),
    });
  },
});
