import * as readline from "node:readline";
import type { SidecarCommand, SidecarEvent } from "./types.js";
import { SessionManager } from "./session.js";

function emit(event: SidecarEvent): void {
  process.stdout.write(JSON.stringify(event) + "\n");
}

const sessions = new SessionManager(emit);

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", async (line: string) => {
  let cmd: SidecarCommand;
  try {
    cmd = JSON.parse(line);
  } catch {
    emit({ type: "error", error: `Invalid JSON: ${line}` });
    return;
  }

  try {
    switch (cmd.type) {
      case "start":
        await sessions.start(cmd);
        break;
      case "send":
        await sessions.send(cmd);
        break;
      case "cancel":
        sessions.cancel(cmd.sessionId);
        break;
      case "tool_response":
        sessions.resolveToolResponse(cmd.requestId, cmd.result);
        break;
      case "stop":
        sessions.closeAll();
        rl.close();
        process.exit(0);
        break;
    }
  } catch (err) {
    emit({
      type: "error",
      sessionId: "sessionId" in cmd ? (cmd as { sessionId: string }).sessionId : undefined,
      error: String(err),
    });
  }
});

// Signal ready
emit({ type: "ready" });
