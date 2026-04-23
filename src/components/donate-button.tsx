"use client";

import { Heart } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const wrapper = "group relative flex h-9 items-center gap-2 rounded-full px-3.5 font-semibold transition-all duration-300 hover:scale-[1.04] active:scale-[0.97]";
const bgGradient = "absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-800 dark:from-emerald-300 dark:via-teal-300 dark:to-indigo-600 ring-1 ring-white/15 transition-opacity";
const glowGradient = "absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/60 via-teal-400/60 to-indigo-800/60 dark:from-emerald-300/60 dark:via-teal-300/60 dark:to-indigo-600/60 blur-md opacity-25 transition-opacity group-hover:opacity-40";
const glassHighlight = "pointer-events-none absolute inset-0 rounded-full shadow-[0_1px_0_0_rgba(255,255,255,0.3)_inset]";
const heartIcon = "relative size-3.5 text-white/90 fill-white/75 animate-[heart-pulse_1.8s_ease-in-out_infinite]";
const labelText = "relative text-[0.8rem] text-white/90 drop-shadow-sm tracking-wide";

export function DonateButton() {
  const pathname = usePathname();

  if (pathname === "/") {
    return (
      <button
        onClick={() => {
          document
            .getElementById("donate")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        className={wrapper}
      >
        <span aria-hidden="true" className={`${bgGradient} opacity-90 group-hover:opacity-100`} />
        <span aria-hidden="true" className={glowGradient} />
        <span aria-hidden="true" className={glassHighlight} />
        <Heart className={heartIcon} />
        <span className={labelText}>Donate</span>
      </button>
    );
  }

  return (
    <Link
      href="/#donate"
      className={wrapper}
    >
      <span aria-hidden="true" className={`${bgGradient} opacity-90 group-hover:opacity-100`} />
      <span aria-hidden="true" className={glowGradient} />
      <span aria-hidden="true" className={glassHighlight} />
      <Heart className={heartIcon} />
      <span className={labelText}>Donate</span>
    </Link>
  );
}