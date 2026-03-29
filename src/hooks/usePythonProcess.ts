import { useRef, useCallback } from "react";
import { Command, type Child } from "@tauri-apps/plugin-shell";
import { useAppStore } from "../stores";

/**
 * Custom hook that manages the Python subprocess lifecycle:
 * spawn with -u -i flags, stdin write, stdout/stderr classification,
 * close/error events, and kill cleanup.
 *
 * Uses useAppStore.getState() inside callbacks to avoid stale closures
 * (per project convention from 03-03/04-01 decisions).
 */
export function usePythonProcess() {
  const childRef = useRef<Child | null>(null);

  const start = useCallback(async () => {
    if (childRef.current) return; // Already running

    const { addEntry, setPythonRunning } = useAppStore.getState();

    const isWindows =
      navigator.userAgent.includes("Windows") ||
      navigator.platform.includes("Win");
    const cmd = isWindows ? "run-python-win" : "run-python";

    const command = Command.create(cmd, ["-u", "-i"]);

    // Register event handlers BEFORE spawn
    command.stdout.on("data", (line: string) => {
      useAppStore.getState().addEntry({ type: "output", text: line });
    });

    command.stderr.on("data", (line: string) => {
      const store = useAppStore.getState();
      if (/^(>>>|\.\.\.)\s?/.test(line)) {
        // Python interactive prompts come through stderr
        store.addEntry({ type: "system", text: line });
      } else if (
        line.includes("Traceback") ||
        line.includes("Error:") ||
        /^\s+File "/.test(line)
      ) {
        store.addEntry({ type: "error", text: line });
      } else {
        store.addEntry({ type: "error", text: line });
      }
    });

    command.on("close", (payload) => {
      childRef.current = null;
      const store = useAppStore.getState();
      store.setPythonRunning(false);
      store.addEntry({
        type: "system",
        text: `Python exited (code ${payload.code})`,
      });
    });

    command.on("error", (err) => {
      useAppStore.getState().addEntry({
        type: "error",
        text: `Process error: ${err}`,
      });
    });

    try {
      const child = await command.spawn();
      childRef.current = child;
      setPythonRunning(true);
      addEntry({ type: "system", text: "Python REPL started" });
    } catch (err) {
      addEntry({
        type: "error",
        text: `Failed to start Python: ${err}`,
      });
    }
  }, []);

  const send = useCallback(async (input: string) => {
    if (!childRef.current) return;
    useAppStore.getState().addEntry({ type: "input", text: input });
    await childRef.current.write(input + "\n"); // MUST include newline
  }, []);

  const kill = useCallback(async () => {
    if (!childRef.current) return;
    await childRef.current.kill();
    childRef.current = null;
    useAppStore.getState().setPythonRunning(false);
  }, []);

  return { start, send, kill };
}
