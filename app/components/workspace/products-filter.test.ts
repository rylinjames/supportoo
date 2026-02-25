import { describe, expect, it } from "vitest";
import { shouldShowProduct } from "./products-filter";

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

