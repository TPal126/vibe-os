import React, { useState } from "react";
import {
  ListTodo,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { AgentTask } from "../../stores/types";

interface TaskProgressCardProps {
  tasks: AgentTask[];
}

const statusIcon: Record<AgentTask["status"], React.ReactNode> = {
  pending: <Circle size={12} className="text-v-dim" />,
  in_progress: <Loader2 size={12} className="text-v-accent animate-spin" />,
  completed: <CheckCircle2 size={12} className="text-v-green" />,
  deleted: <XCircle size={12} className="text-v-red" />,
};

export const TaskProgressCard = React.memo(function TaskProgressCard({
  tasks,
}: TaskProgressCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (tasks.length === 0) return null;

  const completed = tasks.filter((t) => t.status === "completed").length;
  const total = tasks.filter((t) => t.status !== "deleted").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = completed === total && total > 0;

  const summary = `Tasks: ${completed}/${total} complete`;

  return (
    <div
      className={`rounded-lg px-3 py-2 my-1 border ${
        allDone
          ? "bg-v-green/5 border-v-green/20"
          : "bg-v-accent/5 border-v-accent/20"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left"
      >
        <ListTodo
          size={14}
          className={`shrink-0 ${allDone ? "text-v-green" : "text-v-accent"}`}
        />
        <span className="flex-1 text-[12px] text-v-textHi truncate">
          {summary}
        </span>

        {/* Mini progress bar */}
        <div className="w-16 h-1.5 rounded-full bg-v-bg overflow-hidden shrink-0">
          <div
            className={`h-full rounded-full transition-all ${
              allDone ? "bg-v-green" : "bg-v-accent"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {expanded ? (
          <ChevronDown size={12} className="text-v-dim shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-v-dim shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 ml-5 space-y-0.5 animate-fade-slide-in">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-1.5 text-[10px] font-mono text-v-dim"
            >
              {statusIcon[task.status]}
              <span className="truncate">{task.subject}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
