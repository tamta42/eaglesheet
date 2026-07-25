import { detectFormat } from "../src/engine";
import { describe, expect, it } from "vitest";

describe("detectFormat", () => {
  it("treats objects and arrays as JSON", () => {
    expect(detectFormat('{"a":1}')).toBe("json");
    expect(detectFormat("\n  [1,2]\n")).toBe("json");
  });

  it("treats everything else as CSV", () => {
    expect(detectFormat("a,b\n1,2")).toBe("csv");
    expect(detectFormat("")).toBe("csv");
    expect(detectFormat("  order_id,name")).toBe("csv");
  });
});
