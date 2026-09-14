import { describe, expect, it } from "vitest";
import { addUsage, chatCostUsd, NO_USAGE } from "./cost";

describe("assistant cost", () => {
  it("adds up the responses of one answer, cache tokens included", () => {
    let u = addUsage(NO_USAGE, { input_tokens: 4000, output_tokens: 300, cache_creation_input_tokens: 3000 });
    u = addUsage(u, { input_tokens: 6000, output_tokens: 700, cache_read_input_tokens: 20000 });
    u = addUsage(u, { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null });
    expect(u).toEqual({ input: 10000, output: 1000, cacheWrite: 3000, cacheRead: 20000 });
  });

  it("prices each kind of token at its rate", () => {
    // 10k × 2 $ + 1k × 10 $ + 3k × 2,5 $ + 20k × 0,2 $, per million.
    expect(chatCostUsd({ input: 10000, output: 1000, cacheWrite: 3000, cacheRead: 20000 })).toBeCloseTo(0.0415, 6);
    expect(chatCostUsd(NO_USAGE)).toBe(0);
  });
});
