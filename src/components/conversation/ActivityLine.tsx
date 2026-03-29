import React, { useState } from "react";
import { Dot } from "../shared/Dot";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { ChatMessage, ActivityEvent } from "../../stores/types";

interface ActivityLineProps {
  message: ChatMessage;
}

const MAX_VISIBLE_EVENTS = 10;

function toolLabel(event: ActivityEvent): string {
  const name = event.tool ?? event.type;
  const target = event.path?.split(/[/\\]/).pop() ?? "";
  if (target) return `${name}: ${target}`;
  if (event.content) {
    const preview =
      event.content.length > 50
        ? event.content.slice(0, 50) + "..."
        : event.content;
    return `${name}: ${preview}`;
  }
  return name;
}

export const ActivityLine = React.memo(function ActivityLine({
  message,
}: ActivityLineProps) {
  const [expanded, setExpanded] = useState(false);
  const events = (message.cardData?.events as ActivityEvent[]) ?? [];
  const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS);
  const overflowCount = events.length - MAX_VISIBLE_EVENTS;

  return (
    <div className="bg-v-surface/50 rounded px-3 py-1.5 my-1">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Dot color="bg-v-accent" pulse />
        <span className="flex-1 text-[11px] text-v-dim font-mono truncate">
          {message.content}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="text-v-dim shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-v-dim shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 ml-4 space-y-0.5 animate-fade-slide-in">
          {visibleEvents.map((evt, idx) => (
            <div
              key={idx}
              className="text-[10px] text-v-dim/70 font-mono truncate"
            >
              {toolLabel(evt)}
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="text-[10px] text-v-dim/50 font-mono">
              +{overflowCount} more
            </div>
          )}
        </div>
      )}
    </div>
  );
});
