import { expect, test, type Page } from "@playwright/test";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l7Z3YAAAAABJRU5ErkJggg==";
const PNG = Buffer.from(PNG_BASE64, "base64");

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

test("home, privacy, and new-note routes render the current app shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Screenshots in\./ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();

  await page.getByRole("link", { name: "+ New note" }).click();
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByRole("heading", { name: "New note" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate" })).toBeDisabled();

  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText(/never touch our disks/i)).toBeVisible();
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

  await expect(page.getByText("3 screenshots")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate" })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Add more/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(3);

  await expect.poll(() => filmstripNames(page)).toEqual([
    "Screenshot 2026-04-22 at 14.32.00.png",
    "Screenshot_20260422_143300.png",
    "Screenshot 2026-04-22 at 14.34.00.png",
  ]);
  await expect(page.getByText("2026-04-22 14:32:00 · filename")).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Generate" })).toBeDisabled();
});

test("low-confidence order warning appears for tied fallback timestamps", async ({ page }) => {
  await page.goto("/new");

  await upload(page, [screenshot("first-page.png"), screenshot("second-page.png")]);

  await expect(page.getByText("2 screenshots")).toBeVisible();
  await expect(page.getByText(/confidently detect order/)).toBeVisible();
});

test("paste adds a timestamp-named screenshot anywhere on the new-note page", async ({ page }) => {
  await page.goto("/new");
  await expect(page.getByText("Drop screenshots, click to browse, or paste")).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

  const dispatchResult = await page.evaluate((base64) => {
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

  expect(dispatchResult).toBe(false);
  await expect(page.getByText("1 screenshot")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reorder Pasted / })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate" })).toBeEnabled();
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

  await page.getByRole("button", { name: "Reset to auto-detected" }).click();

  await expect.poll(() => filmstripNames(page)).toEqual([
    "Screenshot 2026-04-22 at 14.32.00.png",
    "Screenshot 2026-04-22 at 14.33.00.png",
  ]);
});
