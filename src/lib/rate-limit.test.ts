import { afterEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit } from "./rate-limit";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  KV_URL: process.env.KV_URL,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("checkRateLimit", () => {
  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it("keeps API routes available in production when KV is not configured", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.KV_URL;
    delete process.env.KV_REST_API_URL;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await checkRateLimit(
      new Request("https://powershot.org/api/extract"),
      "extract",
    );

    expect(result).toEqual({ allowed: true });
    expect(errorSpy).toHaveBeenCalledWith(
      "[rate-limit] KV not configured for extract. Rate limiting disabled.",
    );
  });
});
