import { invoke } from "@tauri-apps/api/core";

export const agentCommands = {
  ensureSidecar: () => invoke<string>("ensure_sidecar"),

  startAgent: (sessionId: string, prompt: string, workspacePath: string, composedPrompt?: string) =>
    invoke<void>("start_agent", { sessionId, prompt, workspacePath, composedPrompt: composedPrompt ?? null }),

  sendAgentMessage: (sessionId: string, prompt: string) =>
    invoke<void>("send_agent_message", { sessionId, prompt }),

  cancelAgent: (sessionId: string) =>
    invoke<void>("cancel_agent", { sessionId }),

  getSidecarStatus: () =>
    invoke<"ready" | "starting" | "stopped">("get_sidecar_status"),
};
