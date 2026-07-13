import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("upload page scrolling", () => {
  it("keeps the upload page as its own vertical touch scroll container", () => {
    const uploadPageRule = css.match(/\.upload-page\s*\{([^}]*)\}/)?.[1];

    expect(uploadPageRule).toContain("height: 100dvh");
    expect(uploadPageRule).toContain("overflow-y: auto");
    expect(uploadPageRule).toContain("touch-action: pan-y");
    expect(uploadPageRule).not.toContain("overflow: hidden");
  });
});
