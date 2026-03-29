/**
 * Converts an absolute file path to a workspace-relative path for display.
 *
 * If the absolutePath starts with the workspacePath, strips the workspace root
 * and returns the relative portion (with leading separator removed).
 * Falls back to the original absolute path if not within the workspace.
 *
 * Handles both forward-slash and backslash separators (Windows compat).
 */
export function toWorkspaceRelative(
  absolutePath: string,
  workspacePath: string,
): string {
  if (!absolutePath || !workspacePath) return absolutePath;

  // Normalize separators for comparison
  const normAbsolute = absolutePath.replace(/\\/g, "/");
  const normWorkspace = workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");

  if (normAbsolute.startsWith(normWorkspace + "/")) {
    return normAbsolute.slice(normWorkspace.length + 1);
  }

  // Exact match (path IS the workspace root)
  if (normAbsolute === normWorkspace) {
    return ".";
  }

  // Not within workspace -- return original
  return absolutePath;
}
