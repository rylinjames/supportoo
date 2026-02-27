import { describe, expect, it } from "vitest";
import { hasNonArchivedPlan, shouldShowProduct } from "./products-filter";

describe("shouldShowProduct", () => {
  it("shows visible and active products regardless of toggle", () => {
    expect(
      shouldShowProduct({ isVisible: true, isActive: true }, false)
    ).toBe(true);
    expect(
      shouldShowProduct({ isVisible: true, isActive: true }, true)
    ).toBe(true);
  });

  it("hides hidden products when showHiddenProducts is false", () => {
    expect(
      shouldShowProduct({ isVisible: false, isActive: true }, false)
    ).toBe(false);
  });

  it("hides inactive products when showHiddenProducts is false", () => {
    expect(
      shouldShowProduct({ isVisible: true, isActive: false }, false)
    ).toBe(false);
  });

  it("shows hidden/inactive products when showHiddenProducts is true", () => {
    expect(
      shouldShowProduct({ isVisible: false, isActive: true }, true)
    ).toBe(true);
    expect(
      shouldShowProduct({ isVisible: true, isActive: false }, true)
    ).toBe(true);
  });
});

describe("hasNonArchivedPlan", () => {
  it("returns false when all plans are archived", () => {
    expect(
      hasNonArchivedPlan([{ visibility: "archived" }, { visibility: "archived" }])
    ).toBe(false);
  });

  it("returns true when at least one plan is not archived", () => {
    expect(
      hasNonArchivedPlan([{ visibility: "archived" }, { visibility: "hidden" }])
    ).toBe(true);
    expect(
      hasNonArchivedPlan([{ visibility: "visible" }])
    ).toBe(true);
  });

  it("returns true when no plans exist", () => {
    expect(hasNonArchivedPlan([])).toBe(true);
  });
});
