import type {
  StartCommand,
  SendCommand,
  SidecarEvent,
  ToolResponseCommand,
} from "./types.js";

export class SessionManager {
  constructor(private emit: (event: SidecarEvent) => void) {}
  async start(cmd: StartCommand): Promise<void> { /* stub */ }
  async send(cmd: SendCommand): Promise<void> { /* stub */ }
  cancel(sessionId: string): void { /* stub */ }
  resolveToolResponse(requestId: string, result: ToolResponseCommand["result"]): void { /* stub */ }
  closeAll(): void { /* stub */ }
}
