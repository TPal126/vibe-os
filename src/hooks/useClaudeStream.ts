import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "../stores";
import { commands } from "../lib/tauri";
import {
  isStatusEvent,
  isAgentEvent,
  isAssistantText,
  isInputRequest,
  getSessionId,
} from "../lib/eventParser";
import type { AgentEvent } from "../stores/types";

// ── Detection helpers (module scope) ──

const DEV_SERVER_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1):\d{4,5}\b/;

function extractDevServerUrl(text: string): string | null {
  const match = text.match(DEV_SERVER_URL_RE);
  return match ? match[0] : null;
}

interface ParsedTestResult {
  passed: number;
  failed: number;
  total: number;
  testNames: string[];
}

function parseTestNames(text: string): string[] {
  const names: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Jest/Vitest: "✓ test name" or "✕ test name" or "● test name"
    const checkMatch = trimmed.match(/^[✓✕●✗×√]\s+(.+)/);
    if (checkMatch) {
      names.push(checkMatch[1].replace(/\s+\(\d+\s*m?s\)$/, "").trim());
      continue;
    }

    // pytest: "PASSED test_file.py::test_name" or "FAILED test_file.py::test_name"
    const pytestMatch = trimmed.match(/^(?:PASSED|FAILED)\s+(.+)/);
    if (pytestMatch) {
      names.push(pytestMatch[1].trim());
      continue;
    }

    // Rust: "test module::test_name ... ok" or "test module::test_name ... FAILED"
    const rustMatch = trimmed.match(/^test\s+(.+?)\s+\.\.\.\s+(?:ok|FAILED)/);
    if (rustMatch) {
      names.push(rustMatch[1].trim());
      continue;
    }
  }

  return names;
}

function parseTestResults(text: string): ParsedTestResult | null {
  // Jest/Vitest: "Tests:  3 passed, 1 failed, 4 total" or "Tests:  8 passed, 8 total"
  const jestMatch = text.match(/Tests:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?,\s+(\d+)\s+total/);
  if (jestMatch) {
    return {
      passed: parseInt(jestMatch[1]),
      failed: jestMatch[2] ? parseInt(jestMatch[2]) : 0,
      total: parseInt(jestMatch[3]),
      testNames: parseTestNames(text),
    };
  }

  // Vitest compact: "N tests passed" or "N tests failed"
  const vitestPass = text.match(/(\d+)\s+tests?\s+passed/);
  const vitestFail = text.match(/(\d+)\s+tests?\s+failed/);
  if (vitestPass || vitestFail) {
    const passed = vitestPass ? parseInt(vitestPass[1]) : 0;
    const failed = vitestFail ? parseInt(vitestFail[1]) : 0;
    return { passed, failed, total: passed + failed, testNames: parseTestNames(text) };
  }

  // pytest: "8 passed, 2 failed" or "8 passed"
  const pytestMatch = text.match(/(\d+)\s+passed(?:,\s+(\d+)\s+failed)?/);
  if (pytestMatch) {
    const passed = parseInt(pytestMatch[1]);
    const failed = pytestMatch[2] ? parseInt(pytestMatch[2]) : 0;
    return { passed, failed, total: passed + failed, testNames: parseTestNames(text) };
  }

  // Rust: "test result: ok. 8 passed; 0 failed"
  const rustMatch = text.match(/test result:.*?(\d+)\s+passed;\s+(\d+)\s+failed/);
  if (rustMatch) {
    const passed = parseInt(rustMatch[1]);
    const failed = parseInt(rustMatch[2]);
    return { passed, failed, total: passed + failed, testNames: parseTestNames(text) };
  }

  return null;
}

const BUILD_COMMANDS = ["npm run build", "cargo build", "vite build", "tsc", "make", "npx tsc"];
const SERVE_COMMANDS = ["npm run dev", "npm start", "vite", "python -m http.server", "cargo run", "npx vite"];

function classifyBashCommand(cmd: string): "build" | "serve" | null {
  const normalized = cmd.toLowerCase().trim();
  if (BUILD_COMMANDS.some(bc => normalized.startsWith(bc))) return "build";
  if (SERVE_COMMANDS.some(sc => normalized.startsWith(sc))) return "serve";
  return null;
}

/**
 * Hook that listens to 'claude-stream' Tauri events and dispatches
 * parsed events to the Zustand agentSlice, routed by claude_session_id.
 *
 * Mount this once at the app level (e.g., in App.tsx or the ClaudeChat panel).
 * It handles:
 * - Status events (working/done/cancelled) -> setSessionWorking, setSessionConversationId
 * - Agent events (think/file_create/etc.) -> addSessionAgentEvent
 * - Assistant text -> appendToSessionLastAssistant for streaming chat display
 * - Input-request detection -> setSessionNeedsInput on non-active sessions
 * - Auto-creates sessions in store if events arrive for unknown session id
 */
export function useClaudeStream() {
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      const unlisten = await listen<unknown>(
        "claude-stream",
        async (tauriEvent) => {
          if (!mounted) return;

          const payload = tauriEvent.payload;
          const store = useAppStore.getState();

          // Extract session ID from payload, fall back to active session
          const sessionId =
            getSessionId(payload) ?? store.activeClaudeSessionId;

          // Auto-create session in store if events arrive for unknown session
          if (sessionId && !store.claudeSessions.has(sessionId)) {
            store.createClaudeSessionLocal(sessionId, "Session");
          }

          if (isStatusEvent(payload)) {
            const sid = sessionId;
            switch (payload.status) {
              case "working":
                if (sid) {
                  store.setSessionWorking(sid, true);
                  store.setSessionInvocationId(sid, payload.invocation_id);
                }
                // Legacy dual-write
                store.setWorking(true);
                store.setCurrentInvocationId(payload.invocation_id);
                break;
              case "done":
                if (sid) {
                  store.finalizeActivityLine(sid);
                  store.setSessionWorking(sid, false);
                  store.setSessionInvocationId(sid, null);
                }
                store.setWorking(false);
                store.setCurrentInvocationId(null);
                break;
              case "cancelled":
                if (sid) {
                  store.finalizeActivityLine(sid);
                  store.setSessionWorking(sid, false);
                  store.setSessionInvocationId(sid, null);
                }
                store.setWorking(false);
                store.setCurrentInvocationId(null);
                break;
            }
            return;
          }

          if (isAgentEvent(payload)) {
            const event = payload as AgentEvent;
            const sid = sessionId;

            // Route to session-scoped methods
            if (sid) {
              store.addSessionAgentEvent(sid, event);
            }
            // Legacy dual-write
            store.addAgentEvent(event);

            // Rich card routing: tool events produce inline activity lines
            if (event.metadata?.tool && sid) {
              store.upsertActivityLine(sid, event);

              // Detect URLs in Bash output
              if (event.metadata.tool === "Bash") {
                const detectedUrl = extractDevServerUrl(event.content);
                if (detectedUrl) {
                  const currentSession = useAppStore.getState().claudeSessions.get(sid);
                  if (!currentSession?.previewUrl) {
                    useAppStore.getState().setSessionPreviewUrl(sid, detectedUrl);
                    useAppStore.getState().setSessionBuildStatus(sid, "running", `Running at ${detectedUrl}`);
                    useAppStore.getState().insertRichCard(sid, "preview", `Running at ${detectedUrl}`, {
                      url: detectedUrl,
                    });
                  }
                }
              }

              // Track build/serve status from Bash commands
              if (event.metadata.tool === "Bash") {
                const cmd = (event.metadata.command as string) || event.content;
                const cmdType = classifyBashCommand(cmd);
                if (cmdType === "build") {
                  useAppStore.getState().setSessionBuildStatus(sid, "building", "Building...");
                } else if (cmdType === "serve") {
                  useAppStore.getState().setSessionBuildStatus(sid, "building", "Starting server...");
                }
              }

              // Parse test results from Bash test events
              if (event.event_type === "test_run") {
                const testResult = parseTestResults(event.content);
                if (testResult) {
                  useAppStore.getState().setSessionTestSummary(sid, testResult);
                  useAppStore.getState().insertRichCard(sid, "test-detail",
                    `${testResult.passed}/${testResult.total} tests`,
                    {
                      passed: testResult.passed,
                      failed: testResult.failed,
                      total: testResult.total,
                      testNames: testResult.testNames,
                    }
                  );
                }
              }
            }

            // Handle result events -- extract conversation_id for multi-turn
            if (
              event.event_type === "result" &&
              event.metadata?.session_id
            ) {
              const convId = event.metadata.session_id as string;
              if (sid) {
                store.setSessionConversationId(sid, convId);
              }
              store.setConversationId(convId);

              // Create outcome card from accumulated agent events
              if (sid) {
                const session = useAppStore.getState().claudeSessions.get(sid);
                if (session) {
                  const filesCreated = session.agentEvents
                    .filter((e) => e.event_type === "file_create")
                    .map((e) => (e.metadata?.path as string) || e.content);
                  const filesEdited = session.agentEvents
                    .filter((e) => e.event_type === "file_modify")
                    .map((e) => (e.metadata?.path as string) || e.content);
                  const testEvents = session.agentEvents.filter(
                    (e) => e.event_type === "test_run",
                  );
                  const testsRun = testEvents.length;
                  const testsPassed =
                    testsRun > 0
                      ? testEvents.every(
                          (e) => (e.metadata?.result as string) === "pass",
                        )
                      : null;

                  const fileCount = filesCreated.length + filesEdited.length;
                  if (fileCount > 0 || testsRun > 0) {
                    const testText =
                      testsRun > 0
                        ? testsPassed
                          ? ", all tests passing"
                          : ", tests failed"
                        : "";
                    useAppStore
                      .getState()
                      .insertRichCard(
                        sid,
                        "outcome",
                        `Changed ${fileCount} file${fileCount !== 1 ? "s" : ""}${testText}`,
                        {
                          filesCreated,
                          filesEdited,
                          testsRun,
                          testsPassed,
                          costUsd:
                            (event.metadata?.cost_usd as number) ?? null,
                          durationMs:
                            (event.metadata?.duration_ms as number) ?? null,
                        },
                      );
                  }
                }

                // Finalize build status on result
                const currentForBuild = useAppStore.getState().claudeSessions.get(sid);
                if (currentForBuild?.buildStatus === "building") {
                  if (currentForBuild.previewUrl) {
                    useAppStore.getState().setSessionBuildStatus(sid, "running", `Running at ${currentForBuild.previewUrl}`);
                  } else {
                    useAppStore.getState().setSessionBuildStatus(sid, "idle", null);
                  }
                }
              }
            }

            // Accumulate assistant text into chat messages
            // Finalize activity line before appending assistant text
            if (isAssistantText(event) && event.content) {
              if (sid) {
                store.finalizeActivityLine(sid);
                store.appendToSessionLastAssistant(sid, event.content);

                // Detect dev server URLs in assistant text
                const detectedUrl = extractDevServerUrl(event.content);
                if (detectedUrl && sid) {
                  const currentSession = useAppStore.getState().claudeSessions.get(sid);
                  if (!currentSession?.previewUrl) {
                    useAppStore.getState().setSessionPreviewUrl(sid, detectedUrl);
                    useAppStore.getState().setSessionBuildStatus(sid, "running", `Running at ${detectedUrl}`);
                    useAppStore.getState().insertRichCard(sid, "preview", `Running at ${detectedUrl}`, {
                      url: detectedUrl,
                    });
                  }
                }

                // Parse test results from assistant text
                const testResult = parseTestResults(event.content);
                if (testResult && sid) {
                  useAppStore.getState().setSessionTestSummary(sid, testResult);
                  useAppStore.getState().insertRichCard(sid, "test-detail",
                    `${testResult.passed}/${testResult.total} tests`,
                    {
                      passed: testResult.passed,
                      failed: testResult.failed,
                      total: testResult.total,
                      testNames: testResult.testNames,
                    }
                  );
                }
              } else {
                store.appendToLastAssistant(event.content);
              }
            }

            // Set error state for error events
            if (event.event_type === "error") {
              if (sid) {
                // Insert error card into chat before setting error state
                const lines = event.content.split("\n");
                const errorMessage = lines[0] || "An error occurred";
                useAppStore.getState().insertRichCard(sid, "error", errorMessage, {
                  errorMessage,
                  fullError: event.content,
                  sessionId: sid,
                });

                // Capture errorCardId immediately after insert, before setSessionError
                const errorCardId = useAppStore.getState().claudeSessions.get(sid)
                  ?.chatMessages.slice(-1)[0]?.id ?? null;

                // Set attention for error (if not the active project)
                if (sid !== store.activeClaudeSessionId) {
                  store.setSessionAttention(sid, errorMessage, errorCardId);
                }

                // Transition build status to failed on error
                const currentForBuildErr = useAppStore.getState().claudeSessions.get(sid);
                if (currentForBuildErr?.buildStatus === "building") {
                  useAppStore.getState().setSessionBuildStatus(sid, "failed", "Build failed");
                }

                store.setSessionError(sid, event.content);
              }
              store.setAgentError(event.content);
            }

            // Handle decision events -- create inline decision cards
            if (event.event_type === "decision") {
              if (sid) {
                const meta = event.metadata || {};
                useAppStore.getState().insertRichCard(sid, "decision", event.content, {
                  decision: event.content,
                  rationale: (meta.rationale as string) || "",
                  confidence: (meta.confidence as number) || 0.5,
                  impactCategory: (meta.impact_category as string) || "dx",
                  reversible: (meta.reversible as boolean) || false,
                  relatedFiles: (meta.related_files as string[]) || [],
                });
              }
            }

            // Detect input-request events; set needsInput and attention on non-active sessions
            if (isInputRequest(payload) && sid) {
              if (sid !== store.activeClaudeSessionId) {
                store.setSessionNeedsInput(sid, true);

                // Capture attention preview from last assistant message
                const inputSession = useAppStore.getState().claudeSessions.get(sid);
                if (inputSession) {
                  const lastAssistant = [...inputSession.chatMessages]
                    .reverse()
                    .find(m => m.role === "assistant");
                  const preview = lastAssistant
                    ? lastAssistant.content.split("\n")[0].slice(0, 80)
                    : "Needs your input";
                  const messageId = lastAssistant?.id ?? null;
                  store.setSessionAttention(sid, preview, messageId);
                }
              }
            }

            // Wire file_modify/file_create events to pendingDiffs (keep existing logic)
            if (
              event.event_type === "file_modify" ||
              event.event_type === "file_create"
            ) {
              const filePath =
                (event.metadata?.file_path as string) || "";
              const proposedContent =
                (event.metadata?.content as string) || event.content;

              if (filePath && proposedContent) {
                const originalContent =
                  event.event_type === "file_modify"
                    ? await commands
                        .readFile(filePath)
                        .catch(() => "")
                    : "";

                useAppStore.getState().addPendingDiff({
                  filePath,
                  originalContent,
                  proposedContent,
                  timestamp: event.timestamp,
                });
              }
            }
          }
        },
      );

      if (mounted) {
        unlistenRef.current = unlisten;
      } else {
        unlisten();
      }
    }

    setup();

    return () => {
      mounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);
}
