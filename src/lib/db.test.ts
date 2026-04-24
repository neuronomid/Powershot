import { describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION } from "./db";

describe("PowershotDB schema", () => {
  it("is bumped to v3 for Plan3 deck and deckMedia stores", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });
});
