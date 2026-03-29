import type { SliceCreator, AgentSlice, ChatMessage, AgentEvent } from "../types";

export const createAgentSlice: SliceCreator<AgentSlice> = (set) => ({
  chatMessages: [],
  agentEvents: [],
  isWorking: false,
  conversationId: null,
  currentInvocationId: null,
  agentError: null,

  addChatMessage: (message: ChatMessage) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  addAgentEvent: (event: AgentEvent) =>
    set((state) => ({
      agentEvents: [...state.agentEvents, event],
    })),

  appendToLastAssistant: (text: string) =>
    set((state) => {
      const messages = [...state.chatMessages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        messages[lastIdx] = {
          ...messages[lastIdx],
          content: messages[lastIdx].content + text,
        };
      } else {
        // Create a new assistant message if none exists
        messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: text,
          timestamp: new Date().toISOString(),
        });
      }
      return { chatMessages: messages };
    }),

  setWorking: (working: boolean) => set({ isWorking: working }),

  setConversationId: (id: string | null) => set({ conversationId: id }),

  setCurrentInvocationId: (id: string | null) =>
    set({ currentInvocationId: id }),

  setAgentError: (error: string | null) => set({ agentError: error }),

  clearChat: () =>
    set({
      chatMessages: [],
      agentEvents: [],
      conversationId: null,
      currentInvocationId: null,
      agentError: null,
    }),
});
