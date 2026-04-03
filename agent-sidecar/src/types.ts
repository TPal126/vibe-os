// ── Inbound commands (Rust → Sidecar via stdin) ──

export interface StartCommand {
  type: "start";
  sessionId: string;
  prompt: string;
  systemPrompt: string;
  options: {
    cwd: string;
    resume?: string;
    model?: string;
    permissionMode?: string;
    tools?: { type: "preset"; preset: "claude_code" } | string[];
    allowedTools?: string[];
    disallowedTools?: string[];
    maxTurns?: number;
    settingSources?: string[];
    effort?: "low" | "medium" | "high" | "max";
  };
}

export interface SendCommand {
  type: "send";
  sessionId: string;
  prompt: string;
}

export interface CancelCommand {
  type: "cancel";
  sessionId: string;
}

export interface ToolResponseCommand {
  type: "tool_response";
  requestId: string;
  result: { content: Array<{ type: "text"; text: string }> };
}

export interface StopCommand {
  type: "stop";
}

export type SidecarCommand =
  | StartCommand
  | SendCommand
  | CancelCommand
  | ToolResponseCommand
  | StopCommand;

// ── Outbound events (Sidecar → Rust via stdout) ──

export interface ReadyEvent {
  type: "ready";
}

export interface SdkMessageEvent {
  type: "sdk_message";
  sessionId: string;
  message: unknown; // SDKMessage — serialized as-is
}

export interface ToolRequestEvent {
  type: "tool_request";
  requestId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface SessionEndedEvent {
  type: "session_ended";
  sessionId: string;
}

export interface ErrorEvent {
  type: "error";
  sessionId?: string;
  error: string;
}

export type SidecarEvent =
  | ReadyEvent
  | SdkMessageEvent
  | ToolRequestEvent
  | SessionEndedEvent
  | ErrorEvent;
