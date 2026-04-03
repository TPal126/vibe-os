import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { SidecarEvent, ToolResponseCommand } from "./types.js";

// Pending tool response resolvers
const pendingToolResponses = new Map<
  string,
  (result: ToolResponseCommand["result"]) => void
>();

export function setToolResponseResolver(
  requestId: string,
  result: ToolResponseCommand["result"],
): void {
  const resolver = pendingToolResponses.get(requestId);
  if (resolver) {
    resolver(result);
    pendingToolResponses.delete(requestId);
  }
}

function requestTool(
  emit: (event: SidecarEvent) => void,
  toolName: string,
  input: Record<string, unknown>,
): Promise<ToolResponseCommand["result"]> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    pendingToolResponses.set(requestId, resolve);
    emit({
      type: "tool_request",
      requestId,
      tool: toolName,
      input,
    });
  });
}

export function createVibeTools(emit: (event: SidecarEvent) => void) {
  return [
    tool(
      "vibe_graph_provenance",
      "Get the decision history, skill attribution, test coverage, and modification timeline for a function. Use this to understand WHY code exists and WHO changed it.",
      { functionId: z.string().describe("Qualified function ID like 'repo:module:fn_name'") },
      async ({ functionId }) => {
        const result = await requestTool(emit, "vibe_graph_provenance", { functionId });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "vibe_graph_impact",
      "Get the impact radius of changing a function — direct callers, indirect callers, dependent tickets, and validating tests. Use this before making changes to understand what might break.",
      { functionId: z.string().describe("Qualified function ID like 'repo:module:fn_name'") },
      async ({ functionId }) => {
        const result = await requestTool(emit, "vibe_graph_impact", { functionId });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "vibe_record_decision",
      "Record an architectural decision with rationale, confidence, and impact category. This persists your reasoning into the knowledge graph for future sessions.",
      {
        decision: z.string().describe("What was decided"),
        rationale: z.string().describe("Why this decision was made"),
        confidence: z.number().min(0).max(1).describe("Confidence level 0-1"),
        impactCategory: z.enum(["perf", "accuracy", "dx", "security", "architecture"]),
        reversible: z.boolean().describe("Whether this decision is easily reversible"),
        relatedFiles: z.array(z.string()).optional().describe("File paths affected"),
        relatedTickets: z.array(z.string()).optional().describe("Related ticket IDs"),
      },
      async (args) => {
        const result = await requestTool(emit, "vibe_record_decision", args);
        return result;
      },
    ),

    tool(
      "vibe_search_graph",
      "Search the knowledge graph for functions, modules, decisions, or skills matching a query.",
      { query: z.string().describe("Search query") },
      async ({ query }) => {
        const result = await requestTool(emit, "vibe_search_graph", { query });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "vibe_session_context",
      "Get the current session's action history, decisions made, token spend, and files touched.",
      { sessionId: z.string().describe("Session UUID") },
      async ({ sessionId }) => {
        const result = await requestTool(emit, "vibe_session_context", { sessionId });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "vibe_architecture",
      "Get module topology — imports, call graph, and dependency relationships for a subsystem.",
      { entryPoint: z.string().describe("File path or module name to center the topology on") },
      async ({ entryPoint }) => {
        const result = await requestTool(emit, "vibe_architecture", { entryPoint });
        return result;
      },
      { annotations: { readOnlyHint: true } },
    ),
  ];
}
