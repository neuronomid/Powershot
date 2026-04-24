import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewCard } from "./review-card";
import { initialSM2State, type Card } from "@/lib/flashcard/types";

vi.mock("@/lib/flashcard/media", () => ({
  readMediaAsDataUrl: vi.fn(async () => null),
}));

const NOW = 1_700_000_000_000;

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    model: "basic",
    style: "basic-qa",
    difficulty: "medium",
    front: "What does ATP synthase produce?",
    back: "ATP",
    tags: ["style:basic-qa", "difficulty:medium"],
    scheduler: initialSM2State(NOW),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("ReviewCard", () => {
  it("flips a basic card and exposes the four SM-2-lite grades", () => {
    const onFlip = vi.fn();
    const onGrade = vi.fn();
    const { rerender } = render(
      <ReviewCard
        card={card()}
        flipped={false}
        onFlip={onFlip}
        onGrade={onGrade}
      />,
    );

    expect(screen.getByText("What does ATP synthase produce?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show answer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(onFlip).toHaveBeenCalledOnce();

    rerender(
      <ReviewCard
        card={card()}
        flipped={true}
        onFlip={onFlip}
        onGrade={onGrade}
      />,
    );

    expect(screen.getByText("ATP")).toBeInTheDocument();
    for (const label of ["Again", "Hard", "Good", "Easy"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    expect(onGrade).toHaveBeenCalledExactlyOnceWith("good");
  });

  it("masks and reveals cloze deletions", () => {
    const cloze = card({
      model: "cloze",
      style: "cloze",
      front: "The {{c1::heart::organ}} pumps blood.",
      back: "",
    });
    const { rerender } = render(
      <ReviewCard
        card={cloze}
        flipped={false}
        onFlip={vi.fn()}
        onGrade={vi.fn()}
      />,
    );

    expect(screen.getByText(/organ/)).toBeInTheDocument();
    expect(screen.queryByText("heart")).not.toBeInTheDocument();

    rerender(
      <ReviewCard
        card={cloze}
        flipped={true}
        onFlip={vi.fn()}
        onGrade={vi.fn()}
      />,
    );

    expect(screen.getByText("heart")).toBeInTheDocument();
  });

  it("surfaces guardrail warnings for cards that need review", () => {
    render(
      <ReviewCard
        card={card({ guardrailViolations: ["invented"] })}
        flipped={false}
        onFlip={vi.fn()}
        onGrade={vi.fn()}
      />,
    );

    expect(screen.getByText(/needs review/i)).toBeInTheDocument();
  });
});
