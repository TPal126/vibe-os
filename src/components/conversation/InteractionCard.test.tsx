import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InteractionCard } from "./InteractionCard";
import type { ChatMessage } from "../../stores/types";

afterEach(() => {
  cleanup();
});

describe("InteractionCard", () => {
  const choiceMessage: ChatMessage = {
    id: "msg-1",
    role: "system",
    content: "What stack?",
    timestamp: "2026-04-12T00:00:00Z",
    cardType: "interaction",
    cardData: { options: ["React", "Vue", "Svelte"], inputType: "choice" },
  };

  const textMessage: ChatMessage = {
    id: "msg-2",
    role: "system",
    content: "Describe your project.",
    timestamp: "2026-04-12T00:00:00Z",
    cardType: "interaction",
    cardData: { inputType: "text" },
  };

  const answeredMessage: ChatMessage = {
    id: "msg-3",
    role: "system",
    content: "What stack?",
    timestamp: "2026-04-12T00:00:00Z",
    cardType: "interaction",
    cardData: { options: ["React"], inputType: "choice", answered: true },
  };

  it("renders choice options", () => {
    render(<InteractionCard message={choiceMessage} />);
    expect(screen.getByText("React")).toBeDefined();
    expect(screen.getByText("Vue")).toBeDefined();
    expect(screen.getByText("Svelte")).toBeDefined();
  });

  it("calls onRespond when choice is clicked", () => {
    const onRespond = vi.fn();
    render(<InteractionCard message={choiceMessage} onRespond={onRespond} />);
    fireEvent.click(screen.getByText("React"));
    expect(onRespond).toHaveBeenCalledWith("React");
  });

  it("renders text input when inputType is text", () => {
    render(<InteractionCard message={textMessage} />);
    expect(screen.getByPlaceholderText("Type your answer...")).toBeDefined();
  });

  it("shows Answered state when answered=true", () => {
    render(<InteractionCard message={answeredMessage} />);
    expect(screen.getByText("Answered")).toBeDefined();
  });
});
