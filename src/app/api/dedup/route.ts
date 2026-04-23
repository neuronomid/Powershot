// Runtime: Node. OpenRouter calls can exceed Vercel Edge's 25s initial response
// limit, especially after multi-image extraction.
export const runtime = "nodejs";
export const maxDuration = 60;

import { callDedup } from "@/lib/ai/openrouter";
import {
  checkRateLimit,
  checkRequestSize,
  createRateLimitResponse,
  createSizeLimitResponse,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const sizeCheck = checkRequestSize(request);
  if (!sizeCheck.valid) {
    return createSizeLimitResponse(sizeCheck.size!);
  }

  const rateLimit = await checkRateLimit(request, "dedup");
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.retryAfterSeconds!);
  }

  try {
    const body = (await request.json()) as {
      pairs?: Array<{
        index: number;
        chunkA: string;
        chunkB: string;
      }>;
    };

    if (!Array.isArray(body.pairs) || body.pairs.length === 0) {
      return Response.json(
        { error: "Invalid request. Expected a non-empty 'pairs' array." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          error: "Server configuration error: OPENROUTER_API_KEY is not set.",
        },
        { status: 500 },
      );
    }

    const results = await callDedup(body.pairs, apiKey);

    return Response.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/dedup] Dedup failed:", message);
    return Response.json(
      { error: "Dedup failed. Please try again later." },
      { status: 500 },
    );
  }
}
