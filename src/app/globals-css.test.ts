import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("upload page scrolling", () => {
  it("lets the upload page grow with document scroll instead of trapping results in a fixed container", () => {
    const uploadPageRule = css.match(/\.upload-page\s*\{([^}]*)\}/)?.[1];

    expect(uploadPageRule).toContain("min-height: 100dvh");
    expect(uploadPageRule).not.toMatch(/(^|\s)height:\s*100dvh/);
    expect(uploadPageRule).not.toContain("overflow-y: auto");
    expect(uploadPageRule).not.toContain("touch-action: pan-y");
    expect(uploadPageRule).not.toContain("overflow: hidden");
  });
});
