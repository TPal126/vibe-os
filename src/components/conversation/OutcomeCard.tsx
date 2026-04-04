import React, { useState } from "react";
import { CheckCircle, ChevronRight, ChevronDown } from "lucide-react";
import type { ChatMessage } from "../../stores/types";

interface OutcomeCardProps {
  message: ChatMessage;
}

export const OutcomeCard = React.memo(function OutcomeCard({
  message,
}: OutcomeCardProps) {
  const [expanded, setExpanded] = useState(false);

  const data = message.cardData as
    | {
        filesCreated: string[];
        filesEdited: string[];
        testsRun: number;
        testsPassed: boolean | null;
        costUsd: number | null;
        durationMs: number | null;
      }
    | undefined;

  if (!data) return null;

  const filesCreated = data.filesCreated ?? [];
  const filesEdited = data.filesEdited ?? [];
  const fileCount = filesCreated.length + filesEdited.length;
  const testsRun = data.testsRun ?? 0;
  const testText =
    testsRun > 0
      ? data.testsPassed
        ? ", all tests passing"
        : ", tests failed"
      : "";

  // SDK result path — show cost/turns if no file data
  const costUsd = data.costUsd ?? (data as Record<string, unknown>).cost_usd as number | null;
  const durationMs = data.durationMs ?? (data as Record<string, unknown>).duration_ms as number | null;
  const numTurns = (data as Record<string, unknown>).num_turns as number | undefined;

  const summary = fileCount > 0
    ? `Changed ${fileCount} file${fileCount !== 1 ? "s" : ""}${testText}`
    : numTurns
      ? `Completed in ${numTurns} turn${numTurns !== 1 ? "s" : ""}${costUsd ? ` · $${costUsd.toFixed(4)}` : ""}`
      : "Done";

  return (
    <div className="bg-v-green/5 border border-v-green/20 rounded-lg px-3 py-2 my-1">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left"
      >
        <CheckCircle size={14} className="text-v-green shrink-0" />
        <span className="flex-1 text-[12px] text-v-textHi truncate">
          {summary}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="text-v-dim shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-v-dim shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 ml-5 animate-fade-slide-in">
          {filesCreated.length > 0 && (
            <div className="space-y-0.5">
              {filesCreated.map((filePath) => (
                <div
                  key={filePath}
                  className="text-[10px] font-mono text-v-dim truncate"
                >
                  <span className="text-v-green">Created</span>{" "}
                  {filePath}
                </div>
              ))}
            </div>
          )}
          {filesEdited.length > 0 && (
            <div className="space-y-0.5">
              {filesEdited.map((filePath) => (
                <div
                  key={filePath}
                  className="text-[10px] font-mono text-v-dim truncate"
                >
                  <span className="text-v-accent">Edited</span>{" "}
                  {filePath}
                </div>
              ))}
            </div>
          )}

          {(costUsd != null || durationMs != null) && (
            <div className="mt-1.5 text-[10px] text-v-dim">
              {costUsd != null && (
                <span>Cost: ${costUsd.toFixed(4)}</span>
              )}
              {costUsd != null && durationMs != null && (
                <span className="mx-1">&middot;</span>
              )}
              {durationMs != null && (
                <span>Duration: {(durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
