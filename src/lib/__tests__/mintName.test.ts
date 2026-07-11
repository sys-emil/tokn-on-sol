import { describe, expect, it } from "vitest";
import { onChainName } from "@/lib/mint";

const utf8ByteLength = (s: string) => new TextEncoder().encode(s).length;

describe("onChainName", () => {
  it("keeps names within 32 bytes untouched", () => {
    expect(onChainName("Sommerfest 2026")).toBe("Sommerfest 2026");
  });

  it("keeps a name of exactly 32 bytes untouched", () => {
    const name = "a".repeat(32);
    expect(onChainName(name)).toBe(name);
  });

  it("truncates long names to at most 32 bytes with ellipsis", () => {
    const long = "TV-Planegg Kraliling vs. Eintracht Spontent Düsseldorf";
    const result = onChainName(long);
    expect(utf8ByteLength(result)).toBeLessThanOrEqual(32);
    expect(result.endsWith("…")).toBe(true);
    expect(long.startsWith(result.slice(0, -1).trimEnd())).toBe(true);
  });

  it("counts multi-byte characters by bytes, not chars", () => {
    // 20 × 'ü' = 40 bytes — must be cut although only 20 characters long
    const umlauts = "ü".repeat(20);
    const result = onChainName(umlauts);
    expect(utf8ByteLength(result)).toBeLessThanOrEqual(32);
    expect(result.endsWith("…")).toBe(true);
  });
});
