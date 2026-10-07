import { describe, expect, it } from "vitest";
import { ExtractScriptWriter } from "../src/providers/ExtractScriptWriter";

describe("ExtractScriptWriter", () => {
  const writer = new ExtractScriptWriter();

  it("keeps up to three short sentences", () => {
    const script = writer.write(
      "Första meningen. Andra meningen. Tredje meningen. Fjärde meningen.",
      "Test"
    );
    expect(script).toContain("Första");
    expect(script).toContain("Tredje");
    expect(script).not.toContain("Fjärde");
  });

  it("falls back when extract is empty", () => {
    expect(writer.write("   ", "Mora")).toContain("Mora");
  });

  it("truncates very long single sentences", () => {
    const long = "A".repeat(800) + ".";
    const script = writer.write(long, "X");
    expect(script.length).toBeLessThanOrEqual(400);
  });
});
