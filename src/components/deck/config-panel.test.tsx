import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfigPanel } from "./config-panel";
import type { DeckPreferences } from "@/lib/flashcard/types";

const preferences: DeckPreferences = {
  styles: [
    { style: "basic-qa", count: 3 },
    { style: "cloze", count: 2 },
  ],
  difficulty: "medium",
  styleAutoPick: true,
};

describe("ConfigPanel", () => {
  it("renders all Plan3 flashcard styles and the configured difficulty", () => {
    render(<ConfigPanel preferences={preferences} onChange={vi.fn()} />);

    expect(screen.getByText("Basic Q/A")).toBeInTheDocument();
    expect(screen.getByText("Concept explanation")).toBeInTheDocument();
    expect(screen.getByText("Compare / contrast")).toBeInTheDocument();
    expect(screen.getByText("Multiple-choice")).toBeInTheDocument();
    expect(screen.getByText("Error-based")).toBeInTheDocument();
    expect(screen.getByText("Application / problem")).toBeInTheDocument();
    expect(screen.getByText("Cloze deletion")).toBeInTheDocument();
    expect(screen.getByText("Explain why")).toBeInTheDocument();
    expect(screen.getByText("Diagram / image")).toBeInTheDocument();
    expect(screen.getByText("Exam short-answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "medium" })).toHaveClass(
      "bg-primary",
    );
  });

  it("toggles style auto-pick and changes difficulty", () => {
    const onChange = vi.fn();
    render(<ConfigPanel preferences={preferences} onChange={onChange} />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /let ai skip styles/i,
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith({
      ...preferences,
      styleAutoPick: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "challenging" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...preferences,
      difficulty: "challenging",
    });
  });

  it("adds and removes individual styles while clamping counts", () => {
    const onChange = vi.fn();
    render(<ConfigPanel preferences={preferences} onChange={onChange} />);

    const compareRow = screen.getByText("Compare / contrast").closest("div")
      ?.parentElement;
    expect(compareRow).toBeTruthy();
    fireEvent.click(within(compareRow as HTMLElement).getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...preferences,
      styles: [
        ...preferences.styles,
        { style: "compare", count: 3 },
      ],
    });

    fireEvent.change(screen.getByLabelText("Number of Basic Q/A cards"), {
      target: { value: "25" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...preferences,
      styles: [
        { style: "basic-qa", count: 20 },
        { style: "cloze", count: 2 },
      ],
    });

    const basicRow = screen.getByText("Basic Q/A").closest("div")?.parentElement;
    expect(basicRow).toBeTruthy();
    fireEvent.click(within(basicRow as HTMLElement).getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...preferences,
      styles: [{ style: "cloze", count: 2 }],
    });
  });
});
