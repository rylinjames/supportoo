export type ProductVisibilityInput = {
  isVisible: boolean;
  isActive: boolean;
};

export function shouldShowProduct(
  product: ProductVisibilityInput,
  showHiddenProducts: boolean
): boolean {
  if (product.isVisible && product.isActive) return true;
  return showHiddenProducts;
}

