import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Filmstrip } from "./filmstrip";
import type { StagedImage, TimestampSource } from "@/lib/upload/types";

vi.mock("@/components/upload/thumbnail", () => ({
  Thumbnail: ({ alt }: { alt: string }) => <div data-testid="thumbnail">{alt}</div>,
}));

function image(
  id: string,
  options: {
    name?: string;
    previewUrl?: string | null;
    detectedAt?: Date | null;
    timestampSource?: TimestampSource;
  } = {},
): StagedImage {
  const name = options.name ?? `${id}.png`;
  return {
    id,
    file: new File(["image"], name, { type: "image/png", lastModified: 0 }),
    objectUrl: `blob:${id}`,
    previewUrl: "previewUrl" in options ? options.previewUrl ?? null : `blob:${id}`,
    detectedAt: options.detectedAt ?? null,
    timestampSource: options.timestampSource ?? "insertion",
  };
}

describe("Filmstrip", () => {
  it("renders ordered screenshot tiles with timestamp metadata", () => {
    render(
      <Filmstrip
        images={[
          image("one", {
            name: "Screenshot 2026-04-22 at 14.32.00.png",
            detectedAt: new Date(2026, 3, 22, 14, 32, 0),
            timestampSource: "filename",
          }),
          image("two", {
            name: "page-two.png",
            previewUrl: null,
          }),
        ]}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
    expect(
      screen.getAllByText("Screenshot 2026-04-22 at 14.32.00.png").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("2026-04-22 14:32 via filename")).toBeTruthy();
    expect(screen.getByText("No timestamp")).toBeTruthy();
    expect(screen.getByText("Preview unavailable")).toBeTruthy();
  });

  it("removes the requested image", () => {
    const onRemove = vi.fn();

    render(
      <Filmstrip
        images={[image("one", { name: "first.png" }), image("two", { name: "second.png" })]}
        onReorder={vi.fn()}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove second.png" }));

    expect(onRemove).toHaveBeenCalledExactlyOnceWith("two");
  });

  it("exposes keyboard reorder instructions on each drag handle", () => {
    render(
      <Filmstrip
        images={[image("one", { name: "first.png" })]}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Reorder first.png. Use arrow keys to move this screenshot.",
      }),
    ).toBeTruthy();
  });

  it("moves screenshots with arrow keys", () => {
    const onReorder = vi.fn();

    render(
      <Filmstrip
        images={[image("one", { name: "first.png" }), image("two", { name: "second.png" })]}
        onReorder={onReorder}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("button", {
        name: "Reorder first.png. Use arrow keys to move this screenshot.",
      }),
      { key: "ArrowRight" },
    );

    expect(onReorder).toHaveBeenCalledOnce();
    expect(onReorder.mock.calls[0][0].map((img: StagedImage) => img.file.name)).toEqual([
      "second.png",
      "first.png",
    ]);
  });
});
