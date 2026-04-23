// Runtime: Node. The review pass can exceed Vercel Edge's 25s initial response
// limit for longer notes.
export const runtime = "nodejs";
export const maxDuration = 60;

import { callReview } from "@/lib/ai/openrouter";
import {
  checkRateLimit,
  checkRequestSize,
  createRateLimitResponse,
  createSizeLimitResponse,
} from "@/lib/rate-limit";

function extractWordTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const matches = text.toLowerCase().match(/\b[a-z0-9]+\b/g);
  if (matches) {
    for (const token of matches) {
      tokens.add(token);
    }
  }
  return tokens;
}

export async function POST(request: Request) {
  const sizeCheck = checkRequestSize(request);
  if (!sizeCheck.valid) {
    return createSizeLimitResponse(sizeCheck.size!);
  }

  const rateLimit = await checkRateLimit(request, "review");
  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit.retryAfterSeconds!,
      rateLimit.reason,
    );
  }

  try {
    const body = (await request.json()) as { markdown?: string };

    if (typeof body.markdown !== "string") {
      return Response.json(
        { error: "Invalid request. Expected a 'markdown' string." },
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

    const inputTokens = extractWordTokens(body.markdown);
    const { markdown, warnings } = await callReview(body.markdown, apiKey);
    const outputTokens = extractWordTokens(markdown);

    const violations: string[] = [];
    for (const token of outputTokens) {
      if (!inputTokens.has(token)) {
        violations.push(token);
      }
    }

    if (violations.length > 0) {
      console.warn(
        "[api/review] Token-subset guardrail violations:",
        violations.slice(0, 20),
      );
    }

    return Response.json({
      markdown,
      warnings,
      tokenSubsetViolations: violations.length > 0 ? violations : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/review] Review failed:", message);
    return Response.json(
      { error: "Review failed. Please try again later." },
      { status: 500 },
    );
  }
}
