import { invoke } from "@tauri-apps/api/core";

export const agentCommands = {
  ensureSidecar: () => invoke<string>("ensure_sidecar"),

  startAgent: (sessionId: string, prompt: string, workspacePath: string) =>
    invoke<void>("start_agent", { sessionId, prompt, workspacePath }),

  sendAgentMessage: (sessionId: string, prompt: string) =>
    invoke<void>("send_agent_message", { sessionId, prompt }),

  cancelAgent: (sessionId: string) =>
    invoke<void>("cancel_agent", { sessionId }),

  getSidecarStatus: () =>
    invoke<"ready" | "starting" | "stopped">("get_sidecar_status"),
};
