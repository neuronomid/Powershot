import { describe, expect, it, vi } from "vitest";

import { captureMessageToFiles, dataUrlToFile } from "./files";

describe("extension capture file intake", () => {
  it("decodes base64 data URLs without routing them through fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("fetch should not be used"));

    const file = await dataUrlToFile(
      "data:image/png;base64,aGVsbG8=",
      "Visible tab - docs.example.com",
      123,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(file.name).toBe("visible-tab-docs-example-com.png");
    expect(file.type).toBe("image/png");
    expect(file.lastModified).toBe(123);
    await expect(file.text()).resolves.toBe("hello");
  });

  it("keeps the incoming image order when converting a batch", async () => {
    const files = await captureMessageToFiles({
      type: "POWERSHOT_CAPTURE",
      captureId: "capture-test",
      title: "Three screenshots",
      images: [
        {
          dataUrl: "data:image/png;base64,b25l",
          title: "First capture",
          source: "visible-tab",
        },
        {
          dataUrl: "data:image/jpeg;base64,dHdv",
          title: "Second capture",
          source: "visible-tab",
        },
        {
          dataUrl: "data:image/webp;base64,dGhyZWU=",
          title: "Third capture",
          source: "region",
        },
      ],
    });

    expect(files.map((file) => file.name)).toEqual([
      "first-capture.png",
      "second-capture.jpg",
      "third-capture.webp",
    ]);
    await expect(files[0].text()).resolves.toBe("one");
    await expect(files[1].text()).resolves.toBe("two");
    await expect(files[2].text()).resolves.toBe("three");
    expect(files[1].lastModified).toBeGreaterThan(files[0].lastModified);
    expect(files[2].lastModified).toBeGreaterThan(files[1].lastModified);
  });
});
