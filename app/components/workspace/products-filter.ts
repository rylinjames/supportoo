export type ProductVisibilityInput = {
  isVisible: boolean;
  isActive: boolean;
};

export type PlanVisibilityInput = {
  visibility?: string;
};

export function shouldShowProduct(
  product: ProductVisibilityInput,
  showHiddenProducts: boolean
): boolean {
  if (product.isVisible && product.isActive) return true;
  return showHiddenProducts;
}

export function hasNonArchivedPlan(plans: PlanVisibilityInput[]): boolean {
  if (plans.length === 0) return true;
  return plans.some((plan) => (plan.visibility || "").toLowerCase() !== "archived");
}
