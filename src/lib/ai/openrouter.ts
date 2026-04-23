import {
  CODE_EXTRACTION_SYSTEM_PROMPT,
  DEDUP_SYSTEM_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  MATH_EXTRACTION_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
} from "./prompts";

export const MODEL_CHAIN = [
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "anthropic/claude-haiku-4-5",
] as const;

export const FLASH_MODEL = "google/gemini-2.5-flash";

const DEFAULT_FETCH_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_RETRIES = 1;

const EXTRACTION_TIMEOUT_BY_MODEL: Record<
  (typeof MODEL_CHAIN)[number],
  number
> = {
  "google/gemini-2.5-pro": 32_000,
  "google/gemini-2.5-flash": 14_000,
  "anthropic/claude-haiku-4-5": 8_000,
};

type VisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type OpenRouterMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: VisionContent[] };

type OpenRouterRequest = {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
};

type OpenRouterResponse = {
  choices?: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  error?: { message: string; code?: number };
};

type FetchRetryConfig = {
  maxRetries?: number;
  timeoutMs?: number;
};

function summarizeOpenRouterError(status: number, text: string): string {
  try {
    const data = JSON.parse(text) as {
      error?: {
        message?: string;
        code?: number;
        metadata?: { provider_name?: string };
      };
    };
    const code = data.error?.code ? ` code=${data.error.code}` : "";
    const provider = data.error?.metadata?.provider_name
      ? ` provider=${data.error.metadata.provider_name}`
      : "";
    const message = data.error?.message
      ? ` message=${data.error.message.slice(0, 180)}`
      : "";

    return `status=${status}${code}${provider}${message}`;
  } catch {
    return `status=${status} body=${text.slice(0, 180)}`;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: FetchRetryConfig = {},
): Promise<Response> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  } = config;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxRetries) {
          const delay = 1000 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError ?? new Error("All retries failed");
}

const PROMPT_BY_TYPE: Record<string, string> = {
  default: EXTRACTION_SYSTEM_PROMPT,
  code: CODE_EXTRACTION_SYSTEM_PROMPT,
  math: MATH_EXTRACTION_SYSTEM_PROMPT,
};

/**
 * Extract Markdown from a single image via OpenRouter.
 * Falls back through MODEL_CHAIN on failure.
 *
 * @param imageBase64DataUrl - e.g. "data:image/jpeg;base64,/9j/4AAQ..."
 * @param apiKey - OpenRouter API key
 * @param promptType - Optional prompt variant: "default" | "code" | "math"
 * @returns Extracted markdown and the model that produced it
 */
export async function extractMarkdownFromImage(
  imageBase64DataUrl: string,
  apiKey: string,
  promptType: string = "default",
): Promise<{ markdown: string; model: string }> {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const systemPrompt = PROMPT_BY_TYPE[promptType] ?? EXTRACTION_SYSTEM_PROMPT;

  for (const model of MODEL_CHAIN) {
    try {
      const body: OpenRouterRequest = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the text from this screenshot into Markdown following the rules above.",
              },
              { type: "image_url", image_url: { url: imageBase64DataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      };

      const res = await fetchWithRetry(
        url,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://powershot.org",
            "X-Title": "Powershot",
          },
          body: JSON.stringify(body),
        },
        {
          maxRetries: 0,
          timeoutMs: EXTRACTION_TIMEOUT_BY_MODEL[model],
        },
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        console.error(
          `[openrouter] ${model} returned ${summarizeOpenRouterError(
            res.status,
            errText,
          )}`,
        );
        continue; // try next model in chain
      }

      const data: OpenRouterResponse = await res.json();

      if (data.error) {
        console.error(
          `[openrouter] ${model} API error: ${data.error.message}`,
        );
        continue;
      }

      const markdown = data.choices?.[0]?.message?.content?.trim() ?? "";
      return { markdown, model };
    } catch (err) {
      console.error(
        `[openrouter] ${model} failed:`,
        err instanceof Error ? err.message : String(err),
      );
      // continue to next model
    }
  }

  throw new Error("All models in the fallback chain failed.");
}

/**
 * Call the dedup endpoint via OpenRouter.
 * Sends multiple adjacent chunk pairs and receives deletion spans for each.
 */
export async function callDedup(
  pairs: Array<{ index: number; chunkA: string; chunkB: string }>,
  apiKey: string,
): Promise<
  Array<{ index: number; deletionSpans: Array<{ start: number; end: number }> }>
> {
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const pairsText = pairs
    .map(
      (p) =>
        `PAIR index=${p.index}:\n--- chunkA ---\n${p.chunkA}\n--- chunkB ---\n${p.chunkB}\n--- end pair ---`,
    )
    .join("\n\n");

  const body: OpenRouterRequest = {
    model: FLASH_MODEL,
    messages: [
      { role: "system", content: DEDUP_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Identify overlapping seams for the following pairs:\n\n${pairsText}`,
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://powershot.org",
      "X-Title": "Powershot",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(
      `Dedup failed: ${summarizeOpenRouterError(res.status, errText)}`,
    );
  }

  const data: OpenRouterResponse = await res.json();

  if (data.error) {
    throw new Error(`Dedup API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim() ?? "";

  // Extract JSON from the response (it may be wrapped in markdown code fences)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Dedup response did not contain valid JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    results: Array<{
      index: number;
      deletionSpans: Array<{ start: number; end: number }>;
    }>;
  };

  return parsed.results ?? [];
}

export type ReviewResponse = {
  markdown: string;
  warnings: Array<{ after_chunk: number; before_chunk: number; reason: string }>;
};

/**
 * Call the review endpoint via OpenRouter.
 * Returns revised Markdown and ordering warnings.
 */
export async function callReview(
  markdown: string,
  apiKey: string,
): Promise<ReviewResponse> {
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const body: OpenRouterRequest = {
    model: FLASH_MODEL,
    messages: [
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Review the following Markdown document:\n\n${markdown}`,
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 8192,
  };

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://powershot.org",
      "X-Title": "Powershot",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(
      `Review failed: ${summarizeOpenRouterError(res.status, errText)}`,
    );
  }

  const data: OpenRouterResponse = await res.json();

  if (data.error) {
    throw new Error(`Review API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim() ?? "";

  const mdMatch = content.match(
    /<REVISED_MARKDOWN>([\s\S]*?)<\/REVISED_MARKDOWN>/,
  );
  const warnMatch = content.match(/<WARNINGS>([\s\S]*?)<\/WARNINGS>/);

  const revisedMarkdown = mdMatch?.[1]?.trim() ?? content;

  let warnings: ReviewResponse["warnings"] = [];
  if (warnMatch?.[1]) {
    try {
      warnings = JSON.parse(warnMatch[1].trim()) as ReviewResponse["warnings"];
    } catch {
      warnings = [];
    }
  }

  return { markdown: revisedMarkdown, warnings };
}
