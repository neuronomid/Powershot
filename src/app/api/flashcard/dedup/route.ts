export const runtime = "nodejs";
export const maxDuration = 60;

import { callFlashcardDedup } from "@/lib/ai/openrouter";
import {
  checkRateLimit,
  checkRequestSize,
  createRateLimitResponse,
  createSizeLimitResponse,
} from "@/lib/rate-limit";

type Pair = { candidateIndex: number; candidateText: string; existingTexts: string[] };

function validatePairs(input: unknown): Pair[] | null {
  if (!Array.isArray(input)) return null;
  const out: Pair[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const ci = (item as { candidateIndex?: unknown }).candidateIndex;
    const ct = (item as { candidateText?: unknown }).candidateText;
    const ex = (item as { existingTexts?: unknown }).existingTexts;
    if (typeof ci !== "number" || !Number.isFinite(ci)) return null;
    if (typeof ct !== "string") return null;
    if (!Array.isArray(ex) || ex.some((t) => typeof t !== "string")) return null;
    out.push({ candidateIndex: ci, candidateText: ct, existingTexts: ex as string[] });
  }
  return out;
}

export async function POST(request: Request) {
  const sizeCheck = checkRequestSize(request);
  if (!sizeCheck.valid) return createSizeLimitResponse(sizeCheck.size!);

  const rateLimit = await checkRateLimit(request, "flashcard-dedup");
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.retryAfterSeconds!, rateLimit.reason);
  }

  try {
    const body = (await request.json()) as { pairs?: unknown };
    const pairs = validatePairs(body.pairs);
    if (!pairs) {
      return Response.json(
        { error: "pairs must be an array of {candidateIndex, candidateText, existingTexts}" },
        { status: 400 },
      );
    }

    if (pairs.length === 0 || pairs.every((p) => p.existingTexts.length === 0)) {
      return Response.json({ duplicateIndices: [] });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Server configuration error: OPENROUTER_API_KEY is not set." },
        { status: 500 },
      );
    }

    const { duplicateIndices } = await callFlashcardDedup({ pairs, apiKey });
    return Response.json({ duplicateIndices });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/flashcard/dedup] Failed:", message);
    return Response.json(
      { error: "Flashcard dedup failed. Please try again later." },
      { status: 500 },
    );
  }
}
