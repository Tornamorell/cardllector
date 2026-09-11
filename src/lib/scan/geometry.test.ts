import { describe, expect, it } from "vitest";
import { CARD_RATIO, coverTransform, guideIn, guideRect, stripRect, toVideo } from "./geometry";

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

describe("guideIn", () => {
  it("offsets the guide into the given area", () => {
    const g = guideIn({ x: 0, y: 60, w: 390, h: 580 });
    expect(g.y + g.h / 2).toBeCloseTo(60 + 290);
    expect(g.w / g.h).toBeCloseTo(CARD_RATIO);
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

describe("coverTransform + toVideo", () => {
  it("maps a screen rect back to video pixels for a cropped portrait view", () => {
    // 1080×1920 portrait video shown full screen on a 390×844 phone.
    const t = coverTransform(1080, 1920, 390, 844);
    expect(t.scale).toBeCloseTo(844 / 1920);
    const r = toVideo({ x: 0, y: 0, w: 390, h: 844 }, t);
    expect(r.y).toBeCloseTo(0);
    expect(r.h).toBeCloseTo(1920);
    // The sides are cropped: the visible width is less than the video's.
    expect(r.x).toBeGreaterThan(0);
    expect(r.x + r.w / 2).toBeCloseTo(540);
  });
});
