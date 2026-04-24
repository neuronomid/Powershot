"use client";

import { useEffect, useRef, useCallback } from "react";

interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

export function useScrollReveal(options: ScrollRevealOptions = {}) {
  const { threshold = 0.08, rootMargin = "0px 0px -40px 0px", once = true } = options;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove("revealed");
          }
        });
      },
      { threshold, rootMargin }
    );

    const revealEls = el.querySelectorAll(".scroll-reveal, .stagger-children");
    const hasStagger = el.classList.contains("stagger-children");
    if (hasStagger) observer.observe(el);

    revealEls.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return ref;
}

export function useCountUp(
  target: number,
  duration: number = 1200,
  options: ScrollRevealOptions = {}
) {
  const { threshold = 0.5, once = true } = options;
  const ref = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    const el = ref.current;
    if (!el || (once && hasAnimated.current)) return;

    const start = performance.now();
    hasAnimated.current = true;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [target, duration, once]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate();
          if (once) observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animate, threshold, once]);

  return ref as React.RefObject<HTMLDivElement>;
}