import type { ArchGraph, ArchNode } from "./tauri";

/**
 * Sanitize a string for use as a Mermaid node ID.
 */
function sanitizeId(id: string): string {
  return id.replace(/[:.\/\\@\-\s]/g, "_");
}

/**
 * Convert an ArchGraph to Mermaid flowchart syntax.
 * Groups nodes by repo into subgraphs.
 */
export function archGraphToMermaid(graph: ArchGraph): string {
  if (graph.nodes.length === 0) return "";

  const lines: string[] = ["graph TD"];

  const byRepo = new Map<string, ArchNode[]>();
  for (const node of graph.nodes) {
    const group = byRepo.get(node.repo_name) || [];
    group.push(node);
    byRepo.set(node.repo_name, group);
  }

  for (const [repoName, nodes] of byRepo) {
    const repoId = sanitizeId(repoName);
    lines.push(`  subgraph ${repoId}["${repoName}"]`);
    for (const node of nodes) {
      const sid = sanitizeId(node.id);
      const label = node.label.split(".").pop() || node.label;
      const safeLabel = label.replace(/"/g, "&quot;");
      if (node.node_type === "class") {
        lines.push(`    ${sid}(["${safeLabel}"])`);
      } else if (node.node_type === "function") {
        lines.push(`    ${sid}("${safeLabel}")`);
      } else {
        lines.push(`    ${sid}["${safeLabel}"]`);
      }
    }
    lines.push("  end");
  }

  for (const edge of graph.edges) {
    const from = sanitizeId(edge.from_id);
    const to = sanitizeId(edge.to_id);
    const edgeLabel =
      edge.edge_type !== "imports" ? `|${edge.edge_type}|` : "";
    lines.push(`  ${from} -->${edgeLabel} ${to}`);
  }

  return lines.join("\n");
}
