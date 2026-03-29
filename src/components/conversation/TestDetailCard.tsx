import React, { useState } from "react";
import { CheckCircle, XCircle, ChevronRight, ChevronDown } from "lucide-react";
import type { ChatMessage } from "../../stores/types";

interface TestDetailCardProps {
  message: ChatMessage;
}

export const TestDetailCard = React.memo(function TestDetailCard({
  message,
}: TestDetailCardProps) {
  const [expanded, setExpanded] = useState(false);

  const data = message.cardData as
    | {
        passed: number;
        failed: number;
        total: number;
        testNames: string[];
      }
    | undefined;

  if (!data) return null;

  const allPassed = data.failed === 0;
  const summary = allPassed
    ? `${data.passed}/${data.total} tests passing`
    : `${data.failed} tests failed (${data.passed}/${data.total} passing)`;

  return (
    <div
      className={`rounded-lg px-3 py-2 my-1 border ${
        allPassed
          ? "bg-v-green/5 border-v-green/20"
          : "bg-v-red/5 border-v-red/20"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left"
      >
        {allPassed ? (
          <CheckCircle size={14} className="text-v-green shrink-0" />
        ) : (
          <XCircle size={14} className="text-v-red shrink-0" />
        )}
        <span className="flex-1 text-[12px] text-v-textHi truncate">
          {summary}
        </span>
        {data.testNames.length > 0 &&
          (expanded ? (
            <ChevronDown size={12} className="text-v-dim shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-v-dim shrink-0" />
          ))}
      </button>

      {expanded && data.testNames.length > 0 && (
        <div className="mt-1.5 ml-5 space-y-0.5 animate-fade-slide-in">
          {data.testNames.slice(0, 20).map((name, i) => (
            <div key={i} className="text-[10px] font-mono text-v-dim truncate">
              <span className={allPassed ? "text-v-green" : "text-v-dim"}>
                {allPassed ? "\u2713" : "\u00b7"}
              </span>{" "}
              {name}
            </div>
          ))}
          {data.testNames.length > 20 && (
            <div className="text-[10px] text-v-dim">
              +{data.testNames.length - 20} more
            </div>
          )}
        </div>
      )}
    </div>
  );
});
