import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProgressPanel } from "./progress-panel";
import type { BatchProgress, ExtractionJob } from "@/lib/pipeline/types";

function job(
  overrides: Partial<ExtractionJob> & Pick<ExtractionJob, "imageId" | "fileName">,
): ExtractionJob {
  const { imageId, fileName, ...rest } = overrides;
  return {
    imageId,
    fileName,
    status: "queued",
    markdown: "",
    model: null,
    error: null,
    anchor: {
      imageId,
      startOffset: 0,
      endOffset: 0,
    },
    ...rest,
  };
}

const defaultProgress: BatchProgress = {
  percent: 33,
  label: "Extracting 1 of 3 images…",
  etaSeconds: null,
};

describe("ProgressPanel", () => {
  it("renders per-image status from completed jobs", () => {
    render(
      <ProgressPanel
        jobs={[
          job({ imageId: "one", fileName: "one.png", status: "done" }),
          job({
            imageId: "two",
            fileName: "two.png",
            status: "extracting",
          }),
          job({ imageId: "three", fileName: "three.png", status: "failed" }),
        ]}
        onRetry={vi.fn()}
        progress={defaultProgress}
        stage="extracting"
        totalImages={3}
      />,
    );

    expect(screen.getByText("Per-image status")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Extracting")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("calls onRetry with the failed image id", () => {
    const onRetry = vi.fn();

    render(
      <ProgressPanel
        jobs={[
          job({
            imageId: "failed-image",
            fileName: "scan.png",
            status: "failed",
          }),
        ]}
        onRetry={onRetry}
        progress={null}
        stage="extracting"
        totalImages={1}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledExactlyOnceWith("failed-image");
  });

  it("does not render retry buttons for non-failed jobs", () => {
    render(
      <ProgressPanel
        jobs={[
          job({ imageId: "one", fileName: "one.png", status: "queued" }),
          job({ imageId: "two", fileName: "two.png", status: "done" }),
        ]}
        onRetry={vi.fn()}
        progress={null}
        stage="extracting"
        totalImages={2}
      />,
    );

    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("renders batch progress bar for multi-image runs", () => {
    render(
      <ProgressPanel
        jobs={[
          job({ imageId: "one", fileName: "one.png", status: "done" }),
          job({ imageId: "two", fileName: "two.png", status: "extracting" }),
        ]}
        onRetry={vi.fn()}
        progress={{
          percent: 50,
          label: "Extracting 1 of 2 images…",
          etaSeconds: null,
        }}
        stage="extracting"
        totalImages={2}
      />,
    );

    expect(screen.getByText("Extracting 1 of 2 images…")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar"),
    ).toHaveAttribute("aria-valuenow", "50");
  });

  it("shows model badge when extraction is done", () => {
    render(
      <ProgressPanel
        jobs={[
          job({
            imageId: "one",
            fileName: "one.png",
            status: "done",
            model: "google/gemini-2.5-pro",
          }),
        ]}
        onRetry={vi.fn()}
        progress={null}
        stage="extracting"
        totalImages={1}
      />,
    );

    expect(screen.getByText("Gemini 2.5 Pro")).toBeInTheDocument();
  });
});