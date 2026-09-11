import { describe, expect, it } from "vitest";
import { CARD_RATIO, guideRect, stripRect } from "./geometry";

describe("guideRect", () => {
  it("is limited by height on a landscape frame and centered", () => {
    const g = guideRect(1920, 1080);
    expect(g.h).toBeCloseTo(1080 * 0.86);
    expect(g.w / g.h).toBeCloseTo(CARD_RATIO);
    expect(g.x + g.w / 2).toBeCloseTo(960);
  });

  it("is limited by width on a narrow portrait frame", () => {
    const g = guideRect(600, 1400);
    expect(g.w).toBeCloseTo(600 * 0.86);
    expect(g.y + g.h / 2).toBeCloseTo(700);
  });
});

describe("stripRect", () => {
  it("maps the info strip into frame coordinates", () => {
    const s = stripRect({ x: 100, y: 50, w: 630, h: 880 });
    expect(s.x).toBeCloseTo(100 + 630 * 0.02);
    expect(s.y).toBeCloseTo(50 + 880 * 0.895);
    expect(s.w).toBeCloseTo(630 * 0.48);
    expect(s.h).toBeCloseTo(880 * 0.095);
  });
});
