import { query, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type {
  StartCommand,
  SendCommand,
  SidecarEvent,
  ToolResponseCommand,
} from "./types.js";
import { createVibeTools, setToolResponseResolver } from "./tools.js";

interface ActiveSession {
  sessionId: string;
  query: Query;
  abortController: AbortController;
}

const MAX_SESSIONS = 5;

export class SessionManager {
  private sessions = new Map<string, ActiveSession>();
  private emit: (event: SidecarEvent) => void;

  constructor(emit: (event: SidecarEvent) => void) {
    this.emit = emit;
  }

  async start(cmd: StartCommand): Promise<void> {
    if (this.sessions.size >= MAX_SESSIONS) {
      this.emit({ type: "error", sessionId: cmd.sessionId, error: "Max sessions reached (5)" });
      return;
    }

    if (this.sessions.has(cmd.sessionId)) {
      this.emit({ type: "error", sessionId: cmd.sessionId, error: "Session already exists" });
      return;
    }

    const abortController = new AbortController();

    // Create VIBE OS MCP server with custom tools
    const vibeServer = createSdkMcpServer({
      name: "vibe-os",
      tools: createVibeTools(this.emit),
    });

    const allowedTools = [
      ...(cmd.options.allowedTools ?? []),
      "vibe_graph_provenance",
      "vibe_graph_impact",
      "vibe_record_decision",
      "vibe_search_graph",
      "vibe_session_context",
      "vibe_architecture",
    ];

    const q = query({
      prompt: cmd.prompt,
      options: {
        abortController,
        cwd: cmd.options.cwd,
        systemPrompt: cmd.systemPrompt
          ? { type: "preset" as const, preset: "claude_code" as const, append: cmd.systemPrompt }
          : { type: "preset" as const, preset: "claude_code" as const },
        resume: cmd.options.resume || undefined,
        model: cmd.options.model,
        permissionMode: (cmd.options.permissionMode as "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" | "auto") || "acceptEdits",
        tools: cmd.options.tools ?? { type: "preset", preset: "claude_code" },
        allowedTools,
        disallowedTools: cmd.options.disallowedTools,
        maxTurns: cmd.options.maxTurns ?? 50,
        settingSources: (cmd.options.settingSources as ("user" | "project" | "local")[]) ?? ["project"],
        effort: cmd.options.effort ?? "high",
        mcpServers: { "vibe-os": vibeServer },
        sessionId: cmd.sessionId,
      },
    });

    const session: ActiveSession = { sessionId: cmd.sessionId, query: q, abortController };
    this.sessions.set(cmd.sessionId, session);

    // Stream messages in background
    this.consumeStream(session).catch((err) => {
      this.emit({ type: "error", sessionId: cmd.sessionId, error: String(err) });
    });
  }

  private async consumeStream(session: ActiveSession): Promise<void> {
    try {
      for await (const message of session.query) {
        this.emit({
          type: "sdk_message",
          sessionId: session.sessionId,
          message,
        });
      }
    } finally {
      this.sessions.delete(session.sessionId);
      this.emit({ type: "session_ended", sessionId: session.sessionId });
    }
  }

  async send(cmd: SendCommand): Promise<void> {
    const session = this.sessions.get(cmd.sessionId);
    if (!session) {
      this.emit({ type: "error", sessionId: cmd.sessionId, error: "Session not found" });
      return;
    }

    // Use streamInput for multi-turn
    const inputStream = async function* () {
      yield {
        type: "user" as const,
        session_id: cmd.sessionId,
        message: { role: "user" as const, content: cmd.prompt },
        parent_tool_use_id: null,
      };
    };

    await session.query.streamInput(inputStream());
  }

  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.query.close();
      this.sessions.delete(sessionId);
    }
  }

  resolveToolResponse(requestId: string, result: ToolResponseCommand["result"]): void {
    setToolResponseResolver(requestId, result);
  }

  closeAll(): void {
    for (const [id, session] of this.sessions) {
      session.query.close();
    }
    this.sessions.clear();
  }
}
