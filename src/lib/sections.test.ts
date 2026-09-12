import { describe, expect, it } from "vitest";
import { placeLabel } from "./format";
import { currentSectionId, sectionFill } from "./sections";

const section = (id: string, count: number, capacity: number | null = 100) => ({
  id,
  name: id,
  position: Number(id),
  capacity,
  count,
});

describe("currentSectionId", () => {
  it("picks the last divider with cards in it", () => {
    expect(currentSectionId([section("1", 100), section("2", 37), section("3", 0)])).toBe("2");
  });

  it("starts at the first divider of an empty box, and has none without dividers", () => {
    expect(currentSectionId([section("1", 0), section("2", 0)])).toBe("1");
    expect(currentSectionId([])).toBeNull();
  });
});

describe("sectionFill", () => {
  it("shows the fill against the capacity, or just the count without limit", () => {
    expect(sectionFill(section("1", 87))).toBe("87/100");
    expect(sectionFill(section("1", 12, null))).toBe("12");
  });
});

describe("placeLabel", () => {
  it("joins a location and its divider", () => {
    expect(placeLabel("Caja 1", "3")).toBe("Caja 1 › 3");
    expect(placeLabel("Caja 1", null)).toBe("Caja 1");
    expect(placeLabel(null, "3")).toBeNull();
  });
});
