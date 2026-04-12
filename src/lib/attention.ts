import type { Project, AgentSessionState } from "../stores/types";

export interface AttentionItem {
  projectId: string;
  projectName: string;
  sessionId: string;
  status: "needs-input" | "error";
  preview: string;
  messageId: string | null;
}

export function getAttentionItems(
  projects: Project[],
  sessions: Map<string, AgentSessionState>,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const project of projects) {
    const session = sessions.get(project.activeSessionId);
    if (!session) continue;
    if (session.status === "needs-input" || session.status === "error") {
      items.push({
        projectId: project.id,
        projectName: project.name,
        sessionId: session.id,
        status: session.status,
        preview:
          session.attentionPreview ||
          (session.status === "error" ? "Error occurred" : "Needs input"),
        messageId: session.attentionMessageId,
      });
    }
  }
  return items;
}
