import { useEffect, useRef } from "react";
import { useAppStore } from "../../stores";
import type { AgentEvent, AgentEventType } from "../../stores/types";

const EVENT_CONFIG: Record<
  AgentEventType,
  { icon: string; color: string; label: string }
> = {
  think:          { icon: "\u25C9", color: "var(--color-v-accent)",  label: "Think" },
  decision:       { icon: "\u25C6", color: "var(--color-v-orange)",  label: "Decision" },
  file_create:    { icon: "\u25AA", color: "var(--color-v-green)",   label: "Create" },
  file_modify:    { icon: "\u25AA", color: "var(--color-v-green)",   label: "Modify" },
  test_run:       { icon: "\u25B8", color: "var(--color-v-cyan)",    label: "Test" },
  preview_update: { icon: "\u25D0", color: "var(--color-v-orange)",  label: "Preview" },
  error:          { icon: "\u2715", color: "var(--color-v-red)",     label: "Error" },
  result:         { icon: "\u25CB", color: "var(--color-v-dim)",     label: "Result" },
  raw:            { icon: "\u00B7", color: "var(--color-v-dim)",     label: "Raw" },
};

function EventBadges({ event }: { event: AgentEvent }) {
  const badges: React.ReactNode[] = [];

  if (event.event_type === "decision" && event.metadata?.confidence != null) {
    const confidence = event.metadata.confidence as number;
    const pct = Math.round(confidence * 100);
    let badgeColor: string;
    if (confidence > 0.9) {
      badgeColor = "bg-[#4ade80]/15 text-[#4ade80]";
    } else if (confidence >= 0.8) {
      badgeColor = "bg-[#f59e0b]/15 text-[#f59e0b]";
    } else {
      badgeColor = "bg-[#f97316]/15 text-[#f97316]";
    }
    badges.push(
      <span key="confidence" className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono ${badgeColor}`}>
        {pct}%
      </span>
    );
  }

  if (
    (event.event_type === "file_create" || event.event_type === "file_modify") &&
    event.metadata?.lines != null
  ) {
    const lines = event.metadata.lines as { added?: number; removed?: number };
    const parts: string[] = [];
    if (lines.added) parts.push(`+${lines.added}`);
    if (lines.removed) parts.push(`-${lines.removed}`);
    if (parts.length > 0) {
      badges.push(
        <span key="lines" className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono text-v-dim bg-v-surface">
          {parts.join(" / ")} lines
        </span>
      );
    }
  }

  if (
    (event.event_type === "file_create" || event.event_type === "file_modify") &&
    event.metadata?.path
  ) {
    badges.push(
      <span
        key="path"
        className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono text-v-dim bg-v-surface truncate max-w-[200px]"
        title={event.metadata.path as string}
      >
        {event.metadata.path as string}
      </span>
    );
  }

  if (event.event_type === "test_run" && event.metadata?.result != null) {
    const passed = (event.metadata.result as string) === "pass";
    badges.push(
      <span
        key="test-result"
        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
          passed ? "bg-[#4ade80]/15 text-[#4ade80]" : "bg-[#ef4444]/15 text-[#ef4444]"
        }`}
      >
        {passed ? "PASS" : "FAIL"}
      </span>
    );
  }

  if (event.event_type === "result" && event.metadata?.cost_usd != null) {
    const cost = event.metadata.cost_usd as number;
    badges.push(
      <span key="cost" className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono text-v-dim bg-v-surface">
        ${cost.toFixed(4)}
      </span>
    );
  }

  if (event.event_type === "result" && event.metadata?.duration_ms != null) {
    const ms = event.metadata.duration_ms as number;
    const formatted = ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
    badges.push(
      <span key="duration" className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono text-v-dim bg-v-surface">
        {formatted}
      </span>
    );
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mt-0.5">
      {badges}
    </div>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.raw;

  if (event.event_type === "raw" && !event.content) return null;

  const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 hover:bg-v-surface/50 transition-colors animate-fade-slide-in">
      <span className="shrink-0 text-[9px] font-mono text-v-dim pt-px">
        {time}
      </span>
      <span
        className="shrink-0 text-[11px] pt-px"
        style={{ color: config.color }}
        title={config.label}
      >
        {config.icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-v-text break-words leading-snug">
          {event.content}
        </span>
        <EventBadges event={event} />
      </div>
    </div>
  );
}

export function AgentStream() {
  const agentEvents = useAppStore((s) => s.agentEvents);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentEvents.length]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {agentEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-v-dim">
              Agent events will appear here when Claude is working
            </p>
          </div>
        ) : (
          <div className="divide-y divide-v-border/30">
            {agentEvents.map((event, idx) => (
              <EventRow key={idx} event={event} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
