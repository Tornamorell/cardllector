import { describe, expect, it } from "vitest";
import { gradeLabel } from "./grading";

describe("gradeLabel", () => {
  it("writes company and grade like collectors do", () => {
    expect(gradeLabel("PSA", 10)).toBe("PSA 10");
    expect(gradeLabel("BGS", 9.5)).toBe("BGS 9.5");
    expect(gradeLabel("Cardmarket", 9)).toBe("Cardmarket 9");
  });

  it("copes with a missing grade or company", () => {
    expect(gradeLabel("CGC", null)).toBe("CGC");
    expect(gradeLabel(null, 10)).toBeNull();
  });
});
