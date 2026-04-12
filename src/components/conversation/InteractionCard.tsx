import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import type { ChatMessage } from "../../stores/types";

interface InteractionCardProps {
  message: ChatMessage;
  onRespond?: (answer: string) => void;
}

export function InteractionCard({ message, onRespond }: InteractionCardProps) {
  const [answer, setAnswer] = useState("");
  const data = message.cardData as {
    options?: string[];
    inputType?: "choice" | "text";
    answered?: boolean;
  } | undefined;

  const options = data?.options || [];
  const isChoice = data?.inputType === "choice" && options.length > 0;
  const isAnswered = data?.answered === true;

  const handleSubmit = (value: string) => {
    if (onRespond) onRespond(value);
  };

  return (
    <div className="bg-v-accent/5 border border-v-accent/20 rounded-lg p-3 mx-2">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={14} className="text-v-accent" />
        <span className="text-[10px] text-v-accent font-medium uppercase">Framework Question</span>
      </div>
      <p className="text-xs text-v-textHi mb-3">{message.content}</p>

      {!isAnswered && isChoice && (
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSubmit(opt)}
              className="text-left bg-v-surface border border-v-border rounded px-3 py-2 text-xs text-v-text hover:border-v-accent/50 transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {!isAnswered && !isChoice && (
        <div className="flex gap-2">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && answer.trim()) handleSubmit(answer.trim()); }}
            placeholder="Type your answer..."
            className="flex-1 bg-v-surface border border-v-border rounded px-2.5 py-1.5 text-xs text-v-textHi placeholder:text-v-dim outline-none focus:border-v-accent"
          />
          <button
            onClick={() => { if (answer.trim()) handleSubmit(answer.trim()); }}
            className="bg-v-accent text-white px-2.5 py-1.5 rounded text-xs hover:bg-v-accentHi transition-colors"
          >
            <Send size={12} />
          </button>
        </div>
      )}

      {isAnswered && (
        <p className="text-[10px] text-v-dim italic">Answered</p>
      )}
    </div>
  );
}
