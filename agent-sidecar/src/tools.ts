import type { SidecarEvent } from "./types.js";

// Minimal stub — full implementation in Task 4
export function createVibeTools(_emit: (event: SidecarEvent) => void): Record<string, unknown> {
  return {};
}

const pendingResolvers = new Map<string, (result: unknown) => void>();

export function setToolResponseResolver(requestId: string, result: unknown): void {
  const resolve = pendingResolvers.get(requestId);
  if (resolve) {
    resolve(result);
    pendingResolvers.delete(requestId);
  }
}

export function waitForToolResponse(requestId: string): Promise<unknown> {
  return new Promise((resolve) => {
    pendingResolvers.set(requestId, resolve);
  });
}
