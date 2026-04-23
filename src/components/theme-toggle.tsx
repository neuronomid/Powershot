"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";

const TRANSITION_DURATION = 500;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Required to avoid hydration mismatch with next-themes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const toggleTheme = () => {
    if (
      !(document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } }).startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setTheme(isDark ? "light" : "dark");
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    const goingDark = !isDark;
    const html = document.documentElement;

    // Lock button during transition
    setIsTransitioning(true);

    // Add direction class so CSS can stack the correct pseudo-element on top
    html.classList.add(goingDark ? "vt-going-dark" : "vt-going-light");

    const transition = (document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } }).startViewTransition!(() => {
      setTheme(goingDark ? "dark" : "light");
    });

    transition.ready.then(() => {
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${radius}px at ${x}px ${y}px)`,
      ];

      document.documentElement.animate(
        {
          clipPath: goingDark ? clipPath : [...clipPath].reverse(),
        },
        {
          duration: TRANSITION_DURATION,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: goingDark
            ? "::view-transition-new(root)"
            : "::view-transition-old(root)",
        }
      );
    });

    transition.finished.finally(() => {
      html.classList.remove("vt-going-dark", "vt-going-light");
      setIsTransitioning(false);
    });
  };

  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary/80"
      >
        <div className="h-5 w-5 rounded-full bg-muted-foreground/30" />
      </button>
    );
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        ref={buttonRef}
        onClick={toggleTheme}
        disabled={isTransitioning}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={[
          "group relative flex h-10 w-10 items-center justify-center",
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
          {/* Sun */}
          <div
            className={[
              "absolute inset-0 flex items-center justify-center",
              "transition-all duration-700",
              isDark
                ? "opacity-0 scale-50 rotate-[120deg]"
                : "opacity-100 scale-100 rotate-0",
            ].join(" ")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="overflow-visible"
            >
              {/* Soft outer glow */}
              <circle
                cx="12"
                cy="12"
                r="9"
                className="fill-amber-400/20"
              />
              {/* Sun core */}
              <circle
                cx="12"
                cy="12"
                r="5"
                className="fill-amber-500"
              />
              {/* Rotating rays */}
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

          {/* Moon */}
          <div
            className={[
              "absolute inset-0 flex items-center justify-center",
              "transition-all duration-700",
              isDark
                ? "opacity-100 scale-100 rotate-0"
                : "opacity-0 scale-50 -rotate-[120deg]",
            ].join(" ")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="overflow-visible"
            >
              {/* Moon glow */}
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                className="fill-indigo-300/15"
                transform="scale(1.3) translate(-3.6, -3.6)"
              />
              {/* Moon body */}
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                className="fill-indigo-300"
              />
              {/* Craters */}
              <circle cx="9" cy="9" r="1.1" className="fill-indigo-400/35" />
              <circle cx="14.5" cy="13" r="0.9" className="fill-indigo-400/35" />
              <circle cx="11" cy="16" r="0.7" className="fill-indigo-400/35" />
              <circle cx="16" cy="9.5" r="0.6" className="fill-indigo-400/25" />
              {/* Twinkling stars */}
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
