import { expect, test, type Page } from "@playwright/test";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l7Z3YAAAAABJRU5ErkJggg==";
const PNG = Buffer.from(PNG_BASE64, "base64");
const TERMS_VERSION = "2026-04-23";

function screenshot(name: string) {
  return {
    name,
    mimeType: "image/png",
    buffer: PNG,
  };
}

async function upload(page: Page, files: ReturnType<typeof screenshot>[]) {
  await page.locator('input[type="file"]').setInputFiles(files);
}

async function filmstripNames(page: Page) {
  return page.getByRole("button", { name: /^Reorder / }).evaluateAll((buttons) =>
    buttons.map((button) => button.querySelector("span")?.textContent ?? ""),
  );
}

function collectHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  page.on("console", (message) => {
    const text = message.text();
    if (
      message.type() === "error" &&
      (/Hydration failed/i.test(text) || /React error #418/i.test(text))
    ) {
      errors.push(text);
    }
  });
  return errors;
}

test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: "http://127.0.0.1:3000",
        localStorage: [
          {
            name: "powershot_terms_accepted",
            value: TERMS_VERSION,
          },
        ],
      },
    ],
  },
});

test("new-note route hydrates cleanly when terms were already accepted", async ({
  page,
}) => {
  const hydrationErrors = collectHydrationErrors(page);

  await page.goto("/new");

  await expect(page.getByRole("heading", { name: "Extract from screenshots" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => "__POWERSHOT_CAPTURE_QUEUE__" in window),
    )
    .toBe(true);
  expect(hydrationErrors).toEqual([]);
});

test("home, privacy, and new-note routes render the current app shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Turn any screenshot into clean, structured notes/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Try it free/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();

  await page.getByRole("link", { name: "Create new note" }).click();
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByRole("heading", { name: "Extract from screenshots" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Extract text" })).toBeDisabled();

  await page.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText(/zero server-side persistence/i)).toBeVisible();
});

test("file upload orders screenshots by filename timestamp and enables generation", async ({
  page,
}) => {
  await page.goto("/new");

  await upload(page, [
    screenshot("Screenshot 2026-04-22 at 14.34.00.png"),
    screenshot("Screenshot_20260422_143300.png"),
    screenshot("Screenshot 2026-04-22 at 14.32.00.png"),
  ]);

  await expect(page.getByText("Staged screenshots")).toBeVisible();
  await expect(page.getByRole("button", { name: "Extract text" })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Add more/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(3);

  await expect.poll(() => filmstripNames(page)).toEqual([
    "Screenshot 2026-04-22 at 14.32.00.png",
    "Screenshot_20260422_143300.png",
    "Screenshot 2026-04-22 at 14.34.00.png",
  ]);
  await expect(page.getByText("2026-04-22 14:32 via filename")).toBeVisible();
});

test("unsupported files are rejected inline and do not enable generation", async ({ page }) => {
  await page.goto("/new");

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a screenshot"),
  });

  await expect(page.getByText("1 file skipped")).toBeVisible();
  await expect(page.getByText("notes.txt")).toBeVisible();
  await expect(page.getByText(/file type|unsupported/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Extract text" })).toBeDisabled();
});

test("low-confidence order warning appears for tied fallback timestamps", async ({ page }) => {
  await page.goto("/new");

  await upload(page, [screenshot("first-page.png"), screenshot("second-page.png")]);

  await expect(page.getByText("Order confidence is low")).toBeVisible();
});

test("paste adds a timestamp-named screenshot anywhere on the new-note page", async ({ page }) => {
  await page.goto("/new");
  await expect(page.getByText("Drag files, click to browse, or paste directly")).toBeVisible();

  await page.evaluate((base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const file = new File([bytes], "clipboard.png", { type: "image/png" });
    const event = new Event("paste", { bubbles: true, cancelable: true });

    Object.defineProperty(event, "clipboardData", {
      value: {
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => file,
          },
        ],
      },
    });

    return window.dispatchEvent(event);
  }, PNG_BASE64);

  await expect(page.getByRole("button", { name: /^Reorder Pasted / })).toBeVisible();
  await expect(page.getByRole("button", { name: "Extract text" })).toBeEnabled();
});

test("keyboard reorder changes order and reset restores the auto-detected sequence", async ({
  page,
}) => {
  await page.goto("/new");

  await upload(page, [
    screenshot("Screenshot 2026-04-22 at 14.32.00.png"),
    screenshot("Screenshot 2026-04-22 at 14.33.00.png"),
  ]);

  await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(2);

  const firstHandle = page.getByRole("button", {
    name: /^Reorder Screenshot 2026-04-22 at 14\.32\.00\.png/,
  });
  await firstHandle.focus();
  await firstHandle.press("ArrowRight");

  await expect.poll(() => filmstripNames(page)).toEqual([
    "Screenshot 2026-04-22 at 14.33.00.png",
    "Screenshot 2026-04-22 at 14.32.00.png",
  ]);

  await page.getByRole("button", { name: "Reset order" }).click();

  await expect.poll(() => filmstripNames(page)).toEqual([
    "Screenshot 2026-04-22 at 14.32.00.png",
    "Screenshot 2026-04-22 at 14.33.00.png",
  ]);
});

test("extension-style captures can be staged through the shared postMessage intake", async ({
  page,
}) => {
  const hydrationErrors = collectHydrationErrors(page);

  await page.goto("/new?source=extension");

  await expect(page.getByText("Waiting for your Chrome extension capture")).toBeVisible();

  await page.evaluate((base64) => {
    window.postMessage(
      {
        type: "POWERSHOT_CAPTURE",
        captureId: "capture-e2e",
        title: "Powershot tray - 3 captures",
        images: [
          {
            dataUrl: `data:image/png;base64,${base64}`,
            title: "Visible tab - docs.example.com - 1",
            source: "visible-tab",
          },
          {
            dataUrl: `data:image/png;base64,${base64}`,
            title: "Visible tab - docs.example.com - 2",
            source: "visible-tab",
          },
          {
            dataUrl: `data:image/png;base64,${base64}`,
            title: "Visible tab - docs.example.com - 3",
            source: "visible-tab",
          },
        ],
      },
      window.location.origin,
    );
  }, PNG_BASE64);

  await expect(page.locator("#note-title")).toHaveValue("Powershot tray - 3 captures");
  await expect(page.getByText("Capture imported from the Chrome extension")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(3);
  await expect.poll(() => filmstripNames(page)).toEqual([
    "visible-tab-docs-example-com-1.png",
    "visible-tab-docs-example-com-2.png",
    "visible-tab-docs-example-com-3.png",
  ]);
  expect(hydrationErrors).toEqual([]);
});

test("extension captures extract once before creating flashcards", async ({
  page,
}) => {
  let extractCount = 0;
  const flashcardBodies: Array<Record<string, unknown>> = [];

  await page.route("**/api/extract", async (route) => {
    extractCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        markdown: extractCount === 1 ? "Alpha source" : "Beta source",
        model: "google/gemini-2.5-pro",
      }),
    });
  });

  await page.route("**/api/dedup", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    });
  });

  await page.route("**/api/review", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        markdown: "Alpha source\n\nBeta source",
        warnings: [],
        tokenSubsetViolations: null,
      }),
    });
  });

  await page.route("**/api/flashcard/generate", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    flashcardBodies.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        cards: [
          {
            model: "basic",
            style: "basic-qa",
            difficulty: "medium",
            front: `Question from ${body.markdown}`,
            back: body.markdown,
          },
        ],
        guardrailViolations: [],
      }),
    });
  });

  await page.goto("/new?source=extension");
  await expect
    .poll(() =>
      page.evaluate(() => "__POWERSHOT_CAPTURE_QUEUE__" in window),
    )
    .toBe(true);

  await page.evaluate((base64) => {
    window.postMessage(
      {
        type: "POWERSHOT_CAPTURE",
        captureId: "capture-flashcards-e2e",
        title: "Powershot tray - 2 captures",
        images: [
          {
            dataUrl: `data:image/png;base64,${base64}`,
            title: "Visible tab - alpha.example.com",
            source: "visible-tab",
          },
          {
            dataUrl: `data:image/png;base64,${base64}`,
            title: "Visible tab - beta.example.com",
            source: "visible-tab",
          },
        ],
      },
      window.location.origin,
    );
  }, PNG_BASE64);

  await expect(page.locator("#note-title")).toHaveValue(
    "Powershot tray - 2 captures",
  );
  await expect(page.getByRole("button", { name: "Extract text" })).toBeEnabled();
  await page.getByRole("button", { name: "Extract text" }).click();

  await expect(page.locator("textarea")).toHaveValue(
    "Alpha source\n\nBeta source",
  );
  await expect(page.getByRole("button", { name: "Create flashcards" })).toBeVisible();

  await page.getByRole("button", { name: "Create flashcards" }).click();

  await expect(page).toHaveURL(/\/decks\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: "Powershot tray - 2 captures" }),
  ).toBeVisible();
  await expect(page.getByText("Cards (2)")).toBeVisible();
  expect(extractCount).toBe(2);
  expect(flashcardBodies.map((body) => body.markdown).sort()).toEqual([
    "Alpha source",
    "Beta source",
  ]);
});

test("sample onboarding loads staged assets, auto-runs the pipeline, and can be reset", async ({
  page,
}) => {
  let extractCount = 0;

  await page.route("**/api/extract", async (route) => {
    extractCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        markdown: `## Sample chunk ${extractCount}\n\nBody ${extractCount}`,
        model: "google/gemini-2.5-pro",
      }),
    });
  });

  await page.route("**/api/dedup", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    });
  });

  await page.route("**/api/review", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        markdown:
          "# Powershot sample note\n\n## Lecture slide\n\nDemo output\n\n## Documentation page\n\nDemo output",
        warnings: [],
        tokenSubsetViolations: null,
      }),
    });
  });

  await page.goto("/new?sample=true");

  await expect(page).toHaveURL(/\/new\?sample=true$/);
  await expect(page.getByText("Sample note loaded")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Create note" })).toBeVisible();
  await expect(page.locator("#note-title")).toHaveValue("Powershot sample note");
  await expect(page.locator("textarea")).toHaveValue(/# Powershot sample note/);

  await page.getByRole("button", { name: "Start fresh" }).click();

  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByText("Drop screenshots here to extract")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(0);
});
