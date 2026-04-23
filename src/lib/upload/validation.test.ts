import { describe, expect, it } from "vitest";

import { isAcceptedImage, rejectionReason } from "./validation";

function file(name: string, type = "") {
  return new File(["x"], name, { type });
}

describe("upload validation", () => {
  it.each([
    ["diagram.png", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpg"],
    ["capture.webp", "image/webp"],
    ["phone.heic", "image/heic"],
    ["phone.heif", "image/heif"],
  ])("accepts supported image MIME types: %s", (name, type) => {
    expect(isAcceptedImage(file(name, type))).toBe(true);
  });

  it("accepts supported extensions when the browser omits MIME type", () => {
    expect(isAcceptedImage(file("IMG_20260422_143205.HEIC"))).toBe(true);
  });

  it.each([
    ["archive.zip", "application/zip"],
    ["README.md", "text/markdown"],
  ])("rejects unsupported files: %s", (name, type) => {
    expect(isAcceptedImage(file(name, type))).toBe(false);
  });

  it("accepts PDF files", () => {
    expect(isAcceptedImage(file("notes.pdf", "application/pdf"))).toBe(true);
    expect(isAcceptedImage(file("slides.PDF"))).toBe(true);
  });

  it("reports a useful rejection reason", () => {
    expect(rejectionReason(file("notes.pdf", "application/pdf"))).toBe(
      "Unsupported file type: application/pdf",
    );
    expect(rejectionReason(file("notes.txt"))).toBe("Unsupported file type: txt");
  });
});
