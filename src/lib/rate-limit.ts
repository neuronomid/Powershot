import { kv } from "@vercel/kv";

export const RATE_LIMITS = {
  extract: { limit: 20, windowSeconds: 3600 },
  dedup: { limit: 20, windowSeconds: 3600 },
  review: { limit: 20, windowSeconds: 3600 },
  export: { limit: 30, windowSeconds: 3600 },
  flashcard: { limit: 30, windowSeconds: 3600 },
  "flashcard-dedup": { limit: 30, windowSeconds: 3600 },
} as const;

export type RateLimitRoute = keyof typeof RATE_LIMITS;

const MAX_BODY_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}

function kvAvailable(): boolean {
  try {
    // @vercel/kv throws if env vars are missing when used.
    // We'll do a safe check by attempting to access the URL config.
    return Boolean(process.env.KV_URL || process.env.KV_REST_API_URL);
  } catch {
    return false;
  }
}

export async function checkRateLimit(
  request: Request,
  route: RateLimitRoute,
): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: "limited" | "unconfigured";
}> {
  if (process.env.NODE_ENV === "test") {
    return { allowed: true };
  }

  if (!kvAvailable()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[rate-limit] KV not configured. Rate limiting disabled for ${route}.`,
      );
      return { allowed: true };
    }

    console.error(
      `[rate-limit] KV not configured for ${route}. Rate limiting disabled.`,
    );
    return { allowed: true };
  }

  const ip = getClientIp(request);
  const config = RATE_LIMITS[route];
  const key = `rate-limit:${route}:${ip}`;

  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, config.windowSeconds);
    }

    if (count > config.limit) {
      const ttl = await kv.ttl(key);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, ttl),
        reason: "limited",
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("[rate-limit] KV error:", err);
    // Fail open on KV errors so the app stays functional
    return { allowed: true };
  }
}

export function checkRequestSize(request: Request): {
  valid: boolean;
  size?: number;
} {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!Number.isNaN(size) && size > MAX_BODY_SIZE_BYTES) {
      return { valid: false, size };
    }
  }
  return { valid: true };
}

export function createRateLimitResponse(
  retryAfterSeconds: number,
  reason: "limited" | "unconfigured" = "limited",
): Response {
  if (reason === "unconfigured") {
    return Response.json(
      { error: "Rate limiting is not configured. Please try again later." },
      {
        status: 503,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  const minutes = Math.ceil(retryAfterSeconds / 60);
  const message =
    minutes > 1
      ? `You've reached the limit for now. Please try again in ${minutes} minutes.`
      : `You've reached the limit for now. Please try again in ${retryAfterSeconds} seconds.`;

  return Response.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Content-Type": "application/json",
      },
    },
  );
}

export function createSizeLimitResponse(size: number): Response {
  const mb = (size / 1024 / 1024).toFixed(1);
  return Response.json(
    { error: `Request body too large (${mb} MB). Maximum is 5 MB.` },
    { status: 413 },
  );
}
