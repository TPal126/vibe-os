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
      }));
      set({ agentDefinitions: defs });
    } catch (err) {
      console.warn("[vibe-os] Failed to load agent definitions:", err);
    } finally {
      set({ agentDefinitionsLoading: false });
    }
  },

  saveAgentDefinition: async (name, description, systemPrompt, tools, sourceSessionId) => {
    await commands.saveAgentDefinition(name, description, systemPrompt, tools, sourceSessionId);
    const def = {
      name,
      description,
      systemPrompt,
      tools,
      createdAt: new Date().toISOString().slice(0, 10),
      sourceSessionId,
      active: false,
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
