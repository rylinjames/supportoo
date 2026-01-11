/**
 * Product Sync Multi-Tenancy Tests
 *
 * These tests verify that products are synced to the correct Whop company
 * and that multi-tenancy protections are working correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// EXTRACT TESTABLE FUNCTIONS FROM actions.ts
// These mirror the logic in the actual sync code
// ============================================================================

/**
 * Filter products for a specific company
 * Mirrors the filtering logic in syncProducts (line 163-166)
 */
function filterProductsByCompany(products: any[], expectedCompanyId: string): any[] {
  return products.filter((p: any) => p.company_id === expectedCompanyId);
}

/**
 * Validate multi-tenancy - check that all products belong to expected company
 * Mirrors the validation logic in syncProducts (lines 193-216)
 */
function validateMultiTenancy(products: any[], expectedCompanyId: string): {
  isValid: boolean;
  companyIds: string[];
  mismatchedProducts: any[];
} {
  const companyIds = [...new Set(products.map((p: any) => p.company_id || p.companyId || 'unknown'))];
  const allMatch = companyIds.every(id => id === expectedCompanyId || id === 'unknown');
  const mismatchedProducts = products.filter(p =>
    p.company_id && p.company_id !== expectedCompanyId
  );

  return {
    isValid: allMatch,
    companyIds,
    mismatchedProducts,
  };
}

/**
 * Prepare product data for upsert
 * Mirrors the logic in syncSingleProduct (lines 326-363)
 */
function prepareProductData(
  companyId: string,
  whopCompanyId: string,
  whopProduct: any
) {
  return {
    companyId,
    whopProductId: whopProduct.id,
    // THIS IS THE POTENTIALLY PROBLEMATIC LINE - fallback chain
    whopCompanyId: whopProduct.company_id || whopProduct.companyId || whopCompanyId,
    title: whopProduct.title || whopProduct.name || "Untitled Product",
    description: whopProduct.headline || whopProduct.description || "",
  };
}

/**
 * Strict validation - verifies product actually belongs to expected company
 * This is what SHOULD be added to the codebase
 */
function strictValidateProductOwnership(
  whopProduct: any,
  expectedCompanyId: string
): { isValid: boolean; error?: string } {
  // Product must have a company_id
  if (!whopProduct.company_id) {
    return {
      isValid: false,
      error: `Product ${whopProduct.id} is missing company_id field`,
    };
  }

  // Product must belong to expected company
  if (whopProduct.company_id !== expectedCompanyId) {
    return {
      isValid: false,
      error: `Product ${whopProduct.id} belongs to company ${whopProduct.company_id}, not ${expectedCompanyId}`,
    };
  }

  return { isValid: true };
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Product Sync Multi-Tenancy', () => {
  const COMPANY_A_ID = 'biz_abc123';
  const COMPANY_B_ID = 'biz_xyz789';
  const COMPANY_C_ID = 'biz_def456';

  // Sample products from different companies
  const productFromCompanyA = {
    id: 'prod_a1',
    title: 'Product A1',
    company_id: COMPANY_A_ID,
    visibility: 'visible',
  };

  const productFromCompanyB = {
    id: 'prod_b1',
    title: 'Product B1',
    company_id: COMPANY_B_ID,
    visibility: 'visible',
  };

  const productWithoutCompanyId = {
    id: 'prod_no_company',
    title: 'Product Without Company',
    visibility: 'visible',
    // Missing company_id!
  };

  const productWithCompanyIdVariant = {
    id: 'prod_variant',
    title: 'Product with companyId variant',
    companyId: COMPANY_A_ID, // Using 'companyId' instead of 'company_id'
    visibility: 'visible',
  };

  describe('filterProductsByCompany', () => {
    it('should filter products to only include those from the expected company', () => {
      const mixedProducts = [productFromCompanyA, productFromCompanyB];
      const filtered = filterProductsByCompany(mixedProducts, COMPANY_A_ID);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('prod_a1');
    });

    it('should return empty array when no products match', () => {
      const products = [productFromCompanyA, productFromCompanyB];
      const filtered = filterProductsByCompany(products, COMPANY_C_ID);

      expect(filtered).toHaveLength(0);
    });

    it('should return all products when all match', () => {
      const products = [
        { ...productFromCompanyA, id: 'prod_a1' },
        { ...productFromCompanyA, id: 'prod_a2' },
        { ...productFromCompanyA, id: 'prod_a3' },
      ];
      const filtered = filterProductsByCompany(products, COMPANY_A_ID);

      expect(filtered).toHaveLength(3);
    });

    it('should NOT filter out products without company_id (potential bug)', () => {
      // This test documents current behavior - products without company_id
      // will NOT be included because company_id !== expectedCompanyId
      const products = [productFromCompanyA, productWithoutCompanyId];
      const filtered = filterProductsByCompany(products, COMPANY_A_ID);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('prod_a1');
    });
  });

  describe('validateMultiTenancy', () => {
    it('should pass when all products belong to expected company', () => {
      const products = [
        { ...productFromCompanyA, id: 'prod_a1' },
        { ...productFromCompanyA, id: 'prod_a2' },
      ];

      const result = validateMultiTenancy(products, COMPANY_A_ID);

      expect(result.isValid).toBe(true);
      expect(result.mismatchedProducts).toHaveLength(0);
    });

    it('should fail when products belong to different company', () => {
      const products = [productFromCompanyA, productFromCompanyB];

      const result = validateMultiTenancy(products, COMPANY_A_ID);

      expect(result.isValid).toBe(false);
      expect(result.mismatchedProducts).toHaveLength(1);
      expect(result.mismatchedProducts[0].id).toBe('prod_b1');
    });

    it('should treat "unknown" company_id as valid (potential security issue)', () => {
      // This tests the current behavior where 'unknown' is treated as valid
      // This could be a security concern - products with missing company_id pass validation
      const products = [productFromCompanyA, productWithoutCompanyId];

      const result = validateMultiTenancy(products, COMPANY_A_ID);

      // Current behavior: passes because 'unknown' is allowed
      expect(result.isValid).toBe(true);
    });

    it('should identify all mismatched company IDs', () => {
      const products = [
        productFromCompanyA,
        productFromCompanyB,
        { id: 'prod_c1', title: 'Product C1', company_id: COMPANY_C_ID },
      ];

      const result = validateMultiTenancy(products, COMPANY_A_ID);

      expect(result.isValid).toBe(false);
      expect(result.companyIds).toContain(COMPANY_B_ID);
      expect(result.companyIds).toContain(COMPANY_C_ID);
    });
  });

  describe('prepareProductData - Fallback Chain (CRITICAL)', () => {
    const CONVEX_COMPANY_ID = 'convex_company_123';

    it('should use product company_id when available', () => {
      const result = prepareProductData(
        CONVEX_COMPANY_ID,
        COMPANY_A_ID,
        productFromCompanyA
      );

      expect(result.whopCompanyId).toBe(COMPANY_A_ID);
    });

    it('should fall back to companyId variant when company_id is missing', () => {
      const result = prepareProductData(
        CONVEX_COMPANY_ID,
        COMPANY_A_ID,
        productWithCompanyIdVariant
      );

      // Uses companyId (camelCase) as fallback
      expect(result.whopCompanyId).toBe(COMPANY_A_ID);
    });

    it('SECURITY ISSUE: Falls back to passed whopCompanyId when product has no company ID', () => {
      // THIS IS THE BUG: When a product doesn't have company_id,
      // the code falls back to the expected company ID, masking a potential mismatch
      const result = prepareProductData(
        CONVEX_COMPANY_ID,
        COMPANY_A_ID,
        productWithoutCompanyId
      );

      // The product has NO company_id, but it gets assigned COMPANY_A_ID anyway!
      expect(result.whopCompanyId).toBe(COMPANY_A_ID);
      // This could be a product from ANY company that just has missing data
    });

    it('SECURITY ISSUE: Could sync wrong company product if API response is malformed', () => {
      // Simulate a malformed API response where company_id is null/undefined
      const malformedProduct = {
        id: 'prod_malformed',
        title: 'Malformed Product',
        company_id: null, // Explicitly null
      };

      const result = prepareProductData(
        CONVEX_COMPANY_ID,
        COMPANY_A_ID,
        malformedProduct
      );

      // Falls back to COMPANY_A_ID even though company_id is explicitly null
      expect(result.whopCompanyId).toBe(COMPANY_A_ID);
    });
  });

  describe('strictValidateProductOwnership (Proposed Fix)', () => {
    it('should reject products without company_id', () => {
      const result = strictValidateProductOwnership(
        productWithoutCompanyId,
        COMPANY_A_ID
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('missing company_id');
    });

    it('should reject products from wrong company', () => {
      const result = strictValidateProductOwnership(
        productFromCompanyB,
        COMPANY_A_ID
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('belongs to company');
      expect(result.error).toContain(COMPANY_B_ID);
    });

    it('should accept products from correct company', () => {
      const result = strictValidateProductOwnership(
        productFromCompanyA,
        COMPANY_A_ID
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});

describe('Multi-Company Sync Scenarios', () => {
  describe('Scenario: App API returns products from multiple companies', () => {
    it('should correctly isolate products per company during sync', () => {
      // Simulate Whop API response with products from multiple companies
      const apiResponse = [
        { id: 'prod_1', title: 'Alpha Product', company_id: 'biz_alpha' },
        { id: 'prod_2', title: 'Beta Product', company_id: 'biz_beta' },
        { id: 'prod_3', title: 'Alpha Product 2', company_id: 'biz_alpha' },
        { id: 'prod_4', title: 'Gamma Product', company_id: 'biz_gamma' },
        { id: 'prod_5', title: 'Alpha Product 3', company_id: 'biz_alpha' },
      ];

      // Sync for Alpha company
      const alphaProducts = filterProductsByCompany(apiResponse, 'biz_alpha');
      expect(alphaProducts).toHaveLength(3);
      expect(alphaProducts.every(p => p.company_id === 'biz_alpha')).toBe(true);

      // Sync for Beta company
      const betaProducts = filterProductsByCompany(apiResponse, 'biz_beta');
      expect(betaProducts).toHaveLength(1);
      expect(betaProducts[0].company_id).toBe('biz_beta');

      // Sync for unknown company
      const unknownProducts = filterProductsByCompany(apiResponse, 'biz_unknown');
      expect(unknownProducts).toHaveLength(0);
    });
  });

  describe('Scenario: Cron job syncs all companies', () => {
    it('should sync each company independently without cross-contamination', () => {
      const companies = [
        { id: 'convex_1', whopCompanyId: 'biz_alpha' },
        { id: 'convex_2', whopCompanyId: 'biz_beta' },
        { id: 'convex_3', whopCompanyId: 'biz_gamma' },
      ];

      const apiResponse = [
        { id: 'prod_1', company_id: 'biz_alpha' },
        { id: 'prod_2', company_id: 'biz_beta' },
        { id: 'prod_3', company_id: 'biz_alpha' },
        { id: 'prod_4', company_id: 'biz_gamma' },
      ];

      // Simulate syncing each company
      const syncResults = companies.map(company => {
        const products = filterProductsByCompany(apiResponse, company.whopCompanyId);
        const validation = validateMultiTenancy(products, company.whopCompanyId);

        return {
          companyId: company.id,
          whopCompanyId: company.whopCompanyId,
          productCount: products.length,
          isValid: validation.isValid,
        };
      });

      expect(syncResults[0]).toEqual({
        companyId: 'convex_1',
        whopCompanyId: 'biz_alpha',
        productCount: 2,
        isValid: true,
      });

      expect(syncResults[1]).toEqual({
        companyId: 'convex_2',
        whopCompanyId: 'biz_beta',
        productCount: 1,
        isValid: true,
      });

      expect(syncResults[2]).toEqual({
        companyId: 'convex_3',
        whopCompanyId: 'biz_gamma',
        productCount: 1,
        isValid: true,
      });
    });
  });

  describe('Scenario: Company whopCompanyId mismatch', () => {
    it('should detect when company record has wrong whopCompanyId', () => {
      // Company record says whopCompanyId is 'biz_alpha' but API returns 'biz_beta' products
      const companyRecord = {
        id: 'convex_1',
        whopCompanyId: 'biz_wrong', // WRONG - doesn't match any products
      };

      const apiResponse = [
        { id: 'prod_1', company_id: 'biz_alpha' },
        { id: 'prod_2', company_id: 'biz_beta' },
      ];

      const filtered = filterProductsByCompany(apiResponse, companyRecord.whopCompanyId);

      // Should get zero products because none match
      expect(filtered).toHaveLength(0);
    });
  });
});

describe('Edge Cases and Error Conditions', () => {
  it('should handle empty API response', () => {
    const filtered = filterProductsByCompany([], 'biz_any');
    expect(filtered).toHaveLength(0);

    const validation = validateMultiTenancy([], 'biz_any');
    expect(validation.isValid).toBe(true);
  });

  it('SECURITY ISSUE: Empty string company_id passes validation as falsy', () => {
    const products = [
      { id: 'prod_1', company_id: '' },
    ];

    const filtered = filterProductsByCompany(products, 'biz_expected');
    expect(filtered).toHaveLength(0);

    const validation = validateMultiTenancy(products, 'biz_expected');
    // BUG: Empty string is falsy, so it becomes 'unknown' which passes validation!
    // This is a security issue - empty company_id should FAIL validation
    expect(validation.isValid).toBe(true); // Current buggy behavior
    // SHOULD BE: expect(validation.isValid).toBe(false);
  });

  it('should handle products with whitespace company_id', () => {
    const products = [
      { id: 'prod_1', company_id: '   ' },
    ];

    const filtered = filterProductsByCompany(products, 'biz_expected');
    expect(filtered).toHaveLength(0);
  });

  it('should handle null/undefined in product array', () => {
    const products = [
      { id: 'prod_1', company_id: 'biz_alpha' },
      null,
      undefined,
      { id: 'prod_2', company_id: 'biz_alpha' },
    ];

    // Should handle without throwing (filter out nullish values)
    const validProducts = products.filter(p => p != null);
    const filtered = filterProductsByCompany(validProducts, 'biz_alpha');
    expect(filtered).toHaveLength(2);
  });

  it('should be case-sensitive for company IDs', () => {
    const products = [
      { id: 'prod_1', company_id: 'biz_Alpha' },
      { id: 'prod_2', company_id: 'biz_alpha' },
      { id: 'prod_3', company_id: 'BIZ_ALPHA' },
    ];

    const filtered = filterProductsByCompany(products, 'biz_alpha');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('prod_2');
  });
});

describe('Database Index Usage Simulation', () => {
  // Simulate how the compound index would work
  interface ProductRecord {
    companyId: string; // Convex company ID
    whopProductId: string;
    whopCompanyId: string;
  }

  function simulateCompoundIndexLookup(
    products: ProductRecord[],
    queryCompanyId: string,
    queryWhopProductId: string
  ): ProductRecord | undefined {
    return products.find(
      p => p.companyId === queryCompanyId && p.whopProductId === queryWhopProductId
    );
  }

  it('should isolate products by Convex company ID', () => {
    const existingProducts: ProductRecord[] = [
      { companyId: 'convex_1', whopProductId: 'prod_1', whopCompanyId: 'biz_alpha' },
      { companyId: 'convex_2', whopProductId: 'prod_1', whopCompanyId: 'biz_beta' },
      { companyId: 'convex_1', whopProductId: 'prod_2', whopCompanyId: 'biz_alpha' },
    ];

    // Same whopProductId but different Convex companies should return different records
    const result1 = simulateCompoundIndexLookup(existingProducts, 'convex_1', 'prod_1');
    expect(result1?.whopCompanyId).toBe('biz_alpha');

    const result2 = simulateCompoundIndexLookup(existingProducts, 'convex_2', 'prod_1');
    expect(result2?.whopCompanyId).toBe('biz_beta');
  });

  it('should return undefined for non-existent combination', () => {
    const existingProducts: ProductRecord[] = [
      { companyId: 'convex_1', whopProductId: 'prod_1', whopCompanyId: 'biz_alpha' },
    ];

    const result = simulateCompoundIndexLookup(existingProducts, 'convex_999', 'prod_1');
    expect(result).toBeUndefined();
  });
});
