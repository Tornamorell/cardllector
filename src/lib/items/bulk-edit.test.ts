import { describe, expect, it } from "vitest";
import { applyBulkChange, sameLook, type StackLook } from "./bulk-edit";

const stack: StackLook = { finish: "nonfoil", condition: "NM", language: "en" };

describe("applyBulkChange", () => {
  it("changes only what was chosen", () => {
    expect(applyBulkChange(stack, ["nonfoil", "foil"], { condition: "LP" })).toEqual({
      next: { finish: "nonfoil", condition: "LP", language: "en" },
      finishSkipped: false,
    });
  });

  it("keeps a finish the printing doesn't come in, and still applies the rest", () => {
    expect(applyBulkChange(stack, ["nonfoil"], { finish: "foil", language: "es" })).toEqual({
      next: { finish: "nonfoil", condition: "NM", language: "es" },
      finishSkipped: true,
    });
  });

  it("lets a copy without a catalog entry, or without finishes listed, take any finish", () => {
    expect(applyBulkChange(stack, null, { finish: "etched" }).next.finish).toBe("etched");
    expect(applyBulkChange(stack, [], { finish: "foil" })).toMatchObject({ next: { finish: "foil" }, finishSkipped: false });
  });

  it("doesn't count as skipped a finish the stack already has", () => {
    expect(applyBulkChange(stack, ["foil"], { finish: "nonfoil" }).finishSkipped).toBe(false);
  });
});

describe("sameLook", () => {
  it("tells whether a change left the stack as it was", () => {
    expect(sameLook(applyBulkChange(stack, null, { condition: "NM" }).next, stack)).toBe(true);
    expect(sameLook(applyBulkChange(stack, null, { language: "es" }).next, stack)).toBe(false);
  });
});
