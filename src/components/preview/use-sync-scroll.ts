"use client";

import { useEffect, useRef } from "react";

import type { ChunkAnchor } from "@/lib/pipeline/types";

function getAnchorRatio(anchors: ChunkAnchor[], index: number): number {
  if (anchors.length === 0) return 0;
  const total = anchors[anchors.length - 1]!.endOffset;
  if (total === 0) return 0;
  return (anchors[index]?.startOffset ?? 0) / total;
}

function findAnchorIndexFromRatio(
  anchors: ChunkAnchor[],
  ratio: number,
): number {
  if (anchors.length === 0) return 0;
  const total = anchors[anchors.length - 1]!.endOffset;
  if (total === 0) return 0;
  let idx = 0;
  for (let i = 0; i < anchors.length; i++) {
    const chunkRatio = anchors[i]!.startOffset / total;
    if (chunkRatio <= ratio) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}

type UseSyncScrollOptions = {
  imagePaneRef: React.RefObject<HTMLDivElement | null>;
  editorPaneRef: React.RefObject<HTMLDivElement | null>;
  anchors: ChunkAnchor[];
  enabled: boolean;
  editorFocused: boolean;
  onActiveIndexChange: (index: number) => void;
};

export function useSyncScroll({
  imagePaneRef,
  editorPaneRef,
  anchors,
  enabled,
  editorFocused,
  onActiveIndexChange,
}: UseSyncScrollOptions) {
  const isScrolling = useRef(false);
  const scrollTimer = useRef<number | null>(null);

  const clearScrollLock = () => {
    if (scrollTimer.current) {
      window.clearTimeout(scrollTimer.current);
    }
    scrollTimer.current = window.setTimeout(() => {
      isScrolling.current = false;
    }, 400);
  };

  // IntersectionObserver on image pane → scroll editor pane
  useEffect(() => {
    const imagePane = imagePaneRef.current;
    const editorPane = editorPaneRef.current;
    if (!imagePane || !editorPane || !enabled) return;

    const targets = imagePane.querySelectorAll("[data-image-index]");
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrolling.current || editorFocused) return;

        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }

        if (best && best.intersectionRatio > 0.15) {
          const idx = Number(best.target.getAttribute("data-image-index"));
          onActiveIndexChange(idx);

          const ratio = getAnchorRatio(anchors, idx);
          const maxScroll = editorPane.scrollHeight - editorPane.clientHeight;
          if (maxScroll > 0) {
            isScrolling.current = true;
            editorPane.scrollTo({
              top: ratio * maxScroll,
              behavior: "smooth",
            });
            clearScrollLock();
          }
        }
      },
      {
        root: imagePane,
        threshold: [0, 0.15, 0.3, 0.5, 0.75, 1.0],
      },
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [imagePaneRef, editorPaneRef, anchors, enabled, editorFocused, onActiveIndexChange]);

  // Editor pane scroll → highlight image and scroll image pane
  useEffect(() => {
    const editorPane = editorPaneRef.current;
    const imagePane = imagePaneRef.current;
    if (!editorPane || !imagePane || !enabled) return;

    let raf = 0;

    const handleScroll = () => {
      if (isScrolling.current || editorFocused) return;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const maxScroll = editorPane.scrollHeight - editorPane.clientHeight;
        if (maxScroll <= 0) return;

        const ratio = editorPane.scrollTop / maxScroll;
        const idx = findAnchorIndexFromRatio(anchors, ratio);
        onActiveIndexChange(idx);

        const target = imagePane.querySelector(
          `[data-image-index="${idx}"]`,
        ) as HTMLElement | null;
        if (target) {
          isScrolling.current = true;
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          clearScrollLock();
        }
      });
    };

    editorPane.addEventListener("scroll", handleScroll);
    return () => {
      editorPane.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(raf);
    };
  }, [editorPaneRef, imagePaneRef, anchors, enabled, editorFocused, onActiveIndexChange]);
}
