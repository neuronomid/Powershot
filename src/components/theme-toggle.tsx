"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";

const LIGHT_BG = "oklch(0.99 0.01 260)";
const DARK_BG = "#0d1e38";
const OVERLAY_DURATION = 350;
const VIEW_TRANSITION_DURATION = 500;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const toggleTheme = () => {
    if (!mounted) return;

    const goingDark = !isDark;
    const targetTheme = goingDark ? "dark" : "light";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(targetTheme);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    setIsTransitioning(true);

    if ("startViewTransition" in document) {
      try {
        const transition = (document as unknown as {
          startViewTransition(cb: () => void): {
            ready: Promise<void>;
            finished: Promise<void>;
          };
        }).startViewTransition(() => {
          setTheme(targetTheme);
        });

        transition.ready
          .then(() => {
            const maxDist = Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y),
            );
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${maxDist}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration: VIEW_TRANSITION_DURATION,
                easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                pseudoElement: "::view-transition-new(root)",
              },
            );
          })
          .catch(() => {});

        transition.finished
          .then(() => setIsTransitioning(false))
          .catch(() => setIsTransitioning(false));

        return;
      } catch {
        // Fall through to overlay fallback
      }
    }

    const targetBg = goingDark ? DARK_BG : LIGHT_BG;
    const el = overlayRef.current;
    if (!el) {
      setTheme(targetTheme);
      setIsTransitioning(false);
      return;
    }

    const maxDist = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const scale = Math.ceil(maxDist / 2) + 2;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.backgroundColor = targetBg;
    el.style.transform = "translate(-50%, -50%) scale(0)";
    el.style.transition = "none";

    void el.offsetWidth;

    el.style.transition = `transform ${OVERLAY_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    el.style.transform = `translate(-50%, -50%) scale(${scale})`;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setTheme(targetTheme);
      requestAnimationFrame(() => {
        if (overlayRef.current) {
          overlayRef.current.style.transition = "none";
          overlayRef.current.style.transform =
            "translate(-50%, -50%) scale(0)";
        }
        setIsTransitioning(false);
      });
    };

    const timer = setTimeout(finish, OVERLAY_DURATION + 50);
    el.addEventListener("transitionend", function handler() {
      el.removeEventListener("transitionend", handler);
      clearTimeout(timer);
      finish();
    });
  };

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-secondary/80 sm:h-10 sm:w-10"
      >
        <div className="h-5 w-5 rounded-full bg-muted-foreground/30" />
      </button>
    );
  }

  return (
    <>
      {/* Circular wipe overlay — fallback for browsers without View Transitions API */}
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none fixed z-[9999] rounded-full will-change-transform"
        style={{
          width: "4px",
          height: "4px",
          transform: "translate(-50%, -50%) scale(0)",
        }}
      />

      {/* Toggle Button */}
      <button
        type="button"
        ref={buttonRef}
        onClick={toggleTheme}
        disabled={isTransitioning}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={[
          "group relative flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10",
          "rounded-full bg-secondary/80 hover:bg-secondary",
          "backdrop-blur-sm",
          "border border-border/50",
          "shadow-sm hover:shadow-md",
          "transition-shadow duration-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "active:scale-[0.92] active:transition-transform active:duration-150",
          isTransitioning ? "cursor-wait" : "cursor-pointer",
        ].join(" ")}
      >
        <span className="sr-only">
          {isDark ? "Switch to light mode" : "Switch to dark mode"}
        </span>

        {/* Celestial icon container */}
        <div className="relative h-5 w-5">
          {/* Sun — visible in light mode */}
          <div
            className={[
              "absolute inset-0 flex items-center justify-center",
              "opacity-100 scale-100 rotate-0",
              "dark:opacity-0 dark:scale-50 dark:rotate-[120deg]",
              "transition-[opacity,transform] duration-300",
            ].join(" ")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="overflow-visible"
            >
              <circle cx="12" cy="12" r="9" className="fill-amber-400/20" />
              <circle cx="12" cy="12" r="5" className="fill-amber-500" />
              <g className="origin-center animate-sun-spin">
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                  <line
                    key={angle}
                    x1="12"
                    y1="1.5"
                    x2="12"
                    y2="4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="text-amber-500"
                    transform={`rotate(${angle} 12 12)`}
                  />
                ))}
              </g>
            </svg>
          </div>

          {/* Moon — visible in dark mode */}
          <div
            className={[
              "absolute inset-0 flex items-center justify-center",
              "opacity-0 scale-50 -rotate-[120deg]",
              "dark:opacity-100 dark:scale-100 dark:rotate-0",
              "transition-[opacity,transform] duration-300",
            ].join(" ")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="overflow-visible"
            >
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                className="fill-indigo-300/15"
                transform="scale(1.3) translate(-3.6, -3.6)"
              />
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                className="fill-indigo-300"
              />
              <circle cx="9" cy="9" r="1.1" className="fill-indigo-400/35" />
              <circle cx="14.5" cy="13" r="0.9" className="fill-indigo-400/35" />
              <circle cx="11" cy="16" r="0.7" className="fill-indigo-400/35" />
              <circle cx="16" cy="9.5" r="0.6" className="fill-indigo-400/25" />
              <g>
                <circle cx="3" cy="7" r="0.5" className="fill-indigo-200 animate-twinkle" style={{ animationDelay: "0s" }} />
                <circle cx="20" cy="6" r="0.5" className="fill-indigo-200 animate-twinkle" style={{ animationDelay: "0.5s" }} />
                <circle cx="5" cy="19" r="0.4" className="fill-indigo-200 animate-twinkle" style={{ animationDelay: "1s" }} />
                <circle cx="18" cy="20" r="0.5" className="fill-indigo-200 animate-twinkle" style={{ animationDelay: "0.3s" }} />
                <circle cx="22" cy="14" r="0.4" className="fill-indigo-200 animate-twinkle" style={{ animationDelay: "0.8s" }} />
                <circle cx="2" cy="14" r="0.4" className="fill-indigo-200 animate-twinkle" style={{ animationDelay: "1.3s" }} />
              </g>
            </svg>
          </div>
        </div>
      </button>
    </>
  );
}
