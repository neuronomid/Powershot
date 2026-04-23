// Runtime: Node. Vision extraction can exceed Vercel Edge's 25s initial
// response limit when OpenRouter/Gemini is slow.
export const runtime = "nodejs";
export const maxDuration = 60;

import { extractMarkdownFromImage } from "@/lib/ai/openrouter";
import {
  checkRateLimit,
  checkRequestSize,
  createRateLimitResponse,
  createSizeLimitResponse,
} from "@/lib/rate-limit";

const MAX_IMAGES_PER_BATCH = 30;

export async function POST(request: Request) {
  const sizeCheck = checkRequestSize(request);
  if (!sizeCheck.valid) {
    return createSizeLimitResponse(sizeCheck.size!);
  }

  const rateLimit = await checkRateLimit(request, "extract");
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.retryAfterSeconds!);
  }

  try {
    const body = (await request.json()) as { image?: string; imageCount?: number; promptType?: string };
    const { image, imageCount } = body;

    if (typeof image !== "string" || !image.startsWith("data:")) {
      return Response.json(
        { error: "Invalid image. Expected a base64 data URL string." },
        { status: 400 },
      );
    }

    if (typeof imageCount === "number" && imageCount > MAX_IMAGES_PER_BATCH) {
      return Response.json(
        { error: `Maximum ${MAX_IMAGES_PER_BATCH} images per note.` },
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

    const { markdown, model } = await extractMarkdownFromImage(image, apiKey, body.promptType);

    return Response.json({ markdown, model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Log only the error category / message; never log image bytes or extracted text.
    console.error("[api/extract] Extraction failed:", message);
    return Response.json(
      { error: "Extraction failed. Please try again later." },
      { status: 502 },
    );
  }
}
