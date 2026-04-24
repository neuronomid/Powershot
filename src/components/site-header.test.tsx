import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navState = vi.hoisted(() => ({
  pathname: "/",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("shows Notes and Flashcards nav with the note create action on note routes", () => {
    navState.pathname = "/";

    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Notes" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Flashcards" })).toHaveAttribute(
      "href",
      "/decks",
    );
    expect(screen.getByRole("link", { name: "Notes" })).toHaveClass(
      "active",
    );
    expect(
      screen.getByRole("link", { name: "Create new note" }),
    ).toHaveAttribute("href", "/new");
  });

  it("highlights Flashcards and switches the create action on deck routes", () => {
    navState.pathname = "/decks/deck-1";

    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Flashcards" })).toHaveClass(
      "active",
    );
    expect(
      screen.getByRole("link", { name: "Create new deck" }),
    ).toHaveAttribute("href", "/decks/new");
  });
});
