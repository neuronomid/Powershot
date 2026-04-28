// Runtime: Node. Flashcard generation can exceed Vercel Edge's 25s initial
// response limit for longer passages.
export const runtime = "nodejs";
export const maxDuration = 60;

import { callFlashcardGen } from "@/lib/ai/openrouter";
import {
  checkRateLimit,
  checkRequestSize,
  createRateLimitResponse,
  createSizeLimitResponse,
} from "@/lib/rate-limit";
import type {
  Difficulty,
  StyleCount,
} from "@/lib/flashcard/types";
import { MAX_FLASHCARD_GENERATION_INSTRUCTIONS } from "@/lib/flashcard/types";
import { findAnswerTokenSubsetViolations } from "@/lib/flashcard/guardrail";

const VALID_STYLES = new Set([
  "basic-qa",
  "concept",
  "compare",
  "mcq",
  "error-based",
  "application",
  "cloze",
  "explain-why",
  "diagram",
  "exam-short",
]);

function validateStyles(input: unknown): StyleCount[] | null {
  if (!Array.isArray(input)) return null;
  const out: StyleCount[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const style = (item as { style?: unknown }).style;
    const count = (item as { count?: unknown }).count;
    if (typeof style !== "string" || !VALID_STYLES.has(style)) return null;
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0 || count > 20) {
      return null;
    }
    out.push({ style: style as StyleCount["style"], count: Math.floor(count) });
  }
  return out;
}

export async function POST(request: Request) {
  const sizeCheck = checkRequestSize(request);
  if (!sizeCheck.valid) return createSizeLimitResponse(sizeCheck.size!);

  const rateLimit = await checkRateLimit(request, "flashcard");
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.retryAfterSeconds!, rateLimit.reason);
  }

  try {
    const body = (await request.json()) as {
      markdown?: unknown;
      styles?: unknown;
      difficulty?: unknown;
      autoPick?: unknown;
      instructions?: unknown;
    };

    if (typeof body.markdown !== "string" || body.markdown.trim().length === 0) {
      return Response.json(
        { error: "markdown is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const styles = validateStyles(body.styles);
    if (!styles) {
      return Response.json(
        { error: "styles must be an array of {style, count} objects" },
        { status: 400 },
      );
    }

    const difficulty =
      body.difficulty === "easy" ||
      body.difficulty === "medium" ||
      body.difficulty === "challenging"
        ? (body.difficulty as Difficulty)
        : "medium";

    const autoPick = body.autoPick !== false;
    const instructions =
      typeof body.instructions === "string"
        ? body.instructions.trim().slice(0, MAX_FLASHCARD_GENERATION_INSTRUCTIONS)
        : "";

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Server configuration error: OPENROUTER_API_KEY is not set." },
        { status: 500 },
      );
    }

    const result = await callFlashcardGen({
      markdown: body.markdown,
      styles,
      difficulty,
      autoPick,
      instructions,
      apiKey,
    });

    const violations = findAnswerTokenSubsetViolations({
      sourceMarkdown: body.markdown,
      cards: result.cards,
    });

    if (violations.length > 0) {
      console.warn(
        "[api/flashcard/generate] Token-subset guardrail violations:",
        violations.slice(0, 20),
      );
    }

    return Response.json({
      cards: result.cards,
      guardrailViolations: violations.length > 0 ? violations : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/flashcard/generate] Failed:", message);
    return Response.json(
      { error: "Flashcard generation failed. Please try again later." },
      { status: 502 },
    );
  }
}
