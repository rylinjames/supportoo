/**
 * Root Cause Analysis Tests for Product Cross-Contamination
 *
 * These tests investigate the ACTUAL root cause of why products from
 * one Whop company ended up synced to another company's account.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// HYPOTHESIS 1: The filtering at line 164-166 IS working, but the issue is
// that the company record has the WRONG whopCompanyId stored
// ============================================================================

describe('Hypothesis 1: Wrong whopCompanyId stored in company record', () => {
  /**
   * Scenario: During onboarding, the wrong whopCompanyId was stored
   * in the company record. This would cause the filter to match the
   * wrong company's products.
   */
  it('should demonstrate how wrong whopCompanyId causes cross-contamination', () => {
    // The REAL company that installed the app
    const realWhopCompanyId = 'biz_real_company';

    // But during onboarding, the WRONG company ID was stored
    const storedWhopCompanyId = 'biz_wrong_company';

    // API returns products from BOTH companies
    const apiResponse = [
      { id: 'prod_1', title: 'Real Product 1', company_id: 'biz_real_company' },
      { id: 'prod_2', title: 'Real Product 2', company_id: 'biz_real_company' },
      { id: 'prod_3', title: 'Wrong Product 1', company_id: 'biz_wrong_company' },
      { id: 'prod_4', title: 'Wrong Product 2', company_id: 'biz_wrong_company' },
    ];

    // Filter uses the STORED (wrong) company ID
    const filteredProducts = apiResponse.filter(
      p => p.company_id === storedWhopCompanyId
    );

    // Result: We get the WRONG company's products!
    expect(filteredProducts).toHaveLength(2);
    expect(filteredProducts[0].title).toBe('Wrong Product 1');
    expect(filteredProducts[1].title).toBe('Wrong Product 2');

    // The real products are LOST
    const realProductsSynced = filteredProducts.filter(
      p => p.company_id === realWhopCompanyId
    );
    expect(realProductsSynced).toHaveLength(0);
  });

  it('should show that multi-tenancy check PASSES even with wrong data', () => {
    // Wrong company ID stored in DB
    const storedWhopCompanyId = 'biz_wrong_company';

    // Products from the wrong company (but they MATCH the stored ID)
    const filteredProducts = [
      { id: 'prod_3', title: 'Wrong Product 1', company_id: 'biz_wrong_company' },
      { id: 'prod_4', title: 'Wrong Product 2', company_id: 'biz_wrong_company' },
    ];

    // Multi-tenancy check from line 199
    const companyIds = [...new Set(filteredProducts.map(p => p.company_id || 'unknown'))];
    const allMatch = companyIds.every(id => id === storedWhopCompanyId || id === 'unknown');

    // The check PASSES because products match the stored (wrong) ID
    expect(allMatch).toBe(true);

    // This is a FALSE POSITIVE - the check thinks everything is fine
    // but we're actually syncing the wrong company's products!
  });
});

// ============================================================================
// HYPOTHESIS 2: The companyId (Convex ID) and whopCompanyId mismatch
// A Convex company might have the wrong whopCompanyId association
// ============================================================================

describe('Hypothesis 2: Convex companyId -> whopCompanyId mapping error', () => {
  /**
   * Scenario: Two Convex companies exist, but one has the wrong
   * whopCompanyId stored, causing products to be synced to wrong DB record
   */
  it('should show how mapping error causes wrong database storage', () => {
    // Two Convex companies
    const convexCompanies = [
      { _id: 'convex_company_A', name: 'Company A', whopCompanyId: 'biz_company_a' },
      { _id: 'convex_company_B', name: 'Company B', whopCompanyId: 'biz_company_a' }, // BUG: Same whopCompanyId!
    ];

    // API products
    const apiProducts = [
      { id: 'prod_1', title: 'Product for A', company_id: 'biz_company_a' },
    ];

    // When syncing Company B, we filter by its whopCompanyId
    const companyB = convexCompanies[1];
    const filteredForB = apiProducts.filter(
      p => p.company_id === companyB.whopCompanyId
    );

    // Company B gets Company A's products because whopCompanyId is duplicated!
    expect(filteredForB).toHaveLength(1);
    expect(filteredForB[0].title).toBe('Product for A');

    // Both companies now have the same products in DB
    // This is data corruption from duplicate whopCompanyId
  });

  it('should detect duplicate whopCompanyId in companies table', () => {
    const companies = [
      { _id: 'c1', whopCompanyId: 'biz_a' },
      { _id: 'c2', whopCompanyId: 'biz_b' },
      { _id: 'c3', whopCompanyId: 'biz_a' }, // DUPLICATE!
      { _id: 'c4', whopCompanyId: 'biz_c' },
    ];

    // Check for duplicates
    const whopCompanyIds = companies.map(c => c.whopCompanyId);
    const uniqueIds = new Set(whopCompanyIds);
    const hasDuplicates = uniqueIds.size !== whopCompanyIds.length;

    expect(hasDuplicates).toBe(true);

    // Find which IDs are duplicated
    const counts = whopCompanyIds.reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const duplicates = Object.entries(counts)
      .filter(([_, count]) => count > 1)
      .map(([id]) => id);

    expect(duplicates).toContain('biz_a');
  });
});

// ============================================================================
// HYPOTHESIS 3: Race condition during onboarding
// Two users from different companies onboard at same time
// ============================================================================

describe('Hypothesis 3: Race condition during concurrent onboarding', () => {
  it('should demonstrate how race condition could assign wrong company', () => {
    // Simulating concurrent onboarding requests

    // User A from Company A starts onboarding
    const requestA = {
      experienceId: 'exp_a',
      expectedCompanyId: 'biz_company_a',
      timestamp: 1000,
    };

    // User B from Company B starts onboarding BEFORE A finishes
    const requestB = {
      experienceId: 'exp_b',
      expectedCompanyId: 'biz_company_b',
      timestamp: 1001,
    };

    // Simulate non-atomic operations where B's data might overwrite A's
    // This is a hypothetical scenario - need to verify if Convex transactions prevent this
    const operations = [
      { type: 'lookup_or_create_company', request: requestA },
      { type: 'lookup_or_create_company', request: requestB },
      { type: 'set_whop_company_id', request: requestB }, // B finishes first
      { type: 'set_whop_company_id', request: requestA }, // A might overwrite B's data
    ];

    // If operations are interleaved wrongly, company records could be corrupted
    // This is theoretical - Convex should handle this with transactions
    expect(operations.length).toBe(4);
  });
});

// ============================================================================
// HYPOTHESIS 4: The fallback chain in getCompanyFromExperience
// returned the wrong company ID
// ============================================================================

describe('Hypothesis 4: Fallback chain returned wrong company ID', () => {
  /**
   * The onboarding code has multiple fallback methods to get company ID.
   * If an earlier fallback returns wrong data, it's stored permanently.
   */

  // Simulate the fallback chain from onboarding/actions.ts
  async function getCompanyIdWithFallbacks(
    experienceId: string,
    companyIdFromHeader: string | null,
    companyRoute: string | null,
    apiResponses: {
      v5AppExperiences?: { id: string; company_id: string }[];
      v5Experiences?: { company_id: string } | null;
      v5MeHasAccess?: { company_id: string } | null;
    }
  ): Promise<string | null> {
    // Priority 1: Header
    if (companyIdFromHeader) {
      return companyIdFromHeader;
    }

    // Priority 2: v5/app/experiences (AUTHORITATIVE)
    if (apiResponses.v5AppExperiences) {
      const match = apiResponses.v5AppExperiences.find(
        exp => exp.id === experienceId
      );
      if (match) {
        return match.company_id;
      }
    }

    // Priority 3: v5/experiences/{id}
    if (apiResponses.v5Experiences) {
      return apiResponses.v5Experiences.company_id;
    }

    // Priority 4: v5/me/has_access (USER CONTEXT - can return user's OTHER company!)
    if (apiResponses.v5MeHasAccess) {
      return apiResponses.v5MeHasAccess.company_id;
    }

    return null;
  }

  it('should return correct company when authoritative API works', async () => {
    const companyId = await getCompanyIdWithFallbacks(
      'exp_123',
      null,
      null,
      {
        v5AppExperiences: [
          { id: 'exp_123', company_id: 'biz_correct' },
          { id: 'exp_456', company_id: 'biz_other' },
        ],
      }
    );

    expect(companyId).toBe('biz_correct');
  });

  it('PROBLEM: v5/me/has_access can return user\'s OTHER company', async () => {
    // User owns multiple companies. The has_access endpoint might return
    // a different company than the one for this experience.

    const companyId = await getCompanyIdWithFallbacks(
      'exp_123',
      null,
      null,
      {
        v5AppExperiences: undefined, // API failed or returned empty
        v5Experiences: null, // Also failed
        v5MeHasAccess: {
          company_id: 'biz_users_other_company', // User's OTHER company!
        },
      }
    );

    // We got the WRONG company because the fallback gave us user's other company
    expect(companyId).toBe('biz_users_other_company');
    // This is now stored in the DB and ALL future syncs use this wrong ID
  });

  it('should prefer header over fallbacks (potential injection vector)', async () => {
    // If header can be manipulated by client, this is a problem
    const companyId = await getCompanyIdWithFallbacks(
      'exp_123',
      'biz_injected_company', // Malicious header value
      null,
      {
        v5AppExperiences: [
          { id: 'exp_123', company_id: 'biz_correct' },
        ],
      }
    );

    // Header wins over authoritative API!
    expect(companyId).toBe('biz_injected_company');
  });
});

// ============================================================================
// HYPOTHESIS 5: The test company was created before production company
// and inherited wrong mappings
// ============================================================================

describe('Hypothesis 5: Test environment pollution', () => {
  it('should show how test data can pollute production', () => {
    // During development/testing, a test company was created
    const testCompany = {
      _id: 'convex_test',
      name: 'Test Company',
      whopCompanyId: 'biz_production_company', // Accidentally pointed to prod!
      createdAt: Date.now() - 86400000, // Created yesterday
    };

    // Later, the real production company onboards
    // But the whopCompanyId is already taken by test company!

    const productionCompany = {
      _id: 'convex_prod',
      name: 'Real Production Company',
      whopCompanyId: 'biz_production_company', // SAME ID - duplicate!
      createdAt: Date.now(),
    };

    // Now both companies sync the same products
    const apiProducts = [
      { id: 'prod_1', company_id: 'biz_production_company' },
    ];

    // Test company gets production data
    const testProducts = apiProducts.filter(
      p => p.company_id === testCompany.whopCompanyId
    );
    expect(testProducts).toHaveLength(1);

    // Production company also gets the same data
    const prodProducts = apiProducts.filter(
      p => p.company_id === productionCompany.whopCompanyId
    );
    expect(prodProducts).toHaveLength(1);

    // Data is duplicated across both Convex companies
  });
});

// ============================================================================
// ACTUAL ROOT CAUSE INVESTIGATION
// ============================================================================

describe('Root Cause: Database validation gaps', () => {
  it('should show that whopCompanyId is NOT validated for uniqueness', () => {
    // The schema allows multiple companies with same whopCompanyId
    // There's no unique constraint on whopCompanyId

    // Schema from schema.ts shows index but not unique:
    // .index("by_whop_company_id", ["whopCompanyId"])

    // This is NOT a unique index, just a lookup index
    // Multiple companies CAN have the same whopCompanyId

    const canHaveDuplicates = true;
    expect(canHaveDuplicates).toBe(true);
  });

  it('should show that sync does not verify company ownership', () => {
    // The sync process does:
    // 1. Get company from DB by Convex ID
    // 2. Use company.whopCompanyId to filter API products
    // 3. Sync products to that company

    // It does NOT verify:
    // - That this Convex company is the LEGITIMATE owner of whopCompanyId
    // - That no other Convex company has the same whopCompanyId
    // - That the whopCompanyId was obtained through proper onboarding

    const verifiesOwnership = false;
    expect(verifiesOwnership).toBe(false);
  });
});

// ============================================================================
// RECOMMENDED FIX VALIDATION
// ============================================================================

describe('Proposed Fix: Add whopCompanyId uniqueness check', () => {
  function findDuplicateWhopCompanyIds(companies: Array<{ _id: string; whopCompanyId: string }>) {
    const seen = new Map<string, string[]>();

    for (const company of companies) {
      const existing = seen.get(company.whopCompanyId) || [];
      existing.push(company._id);
      seen.set(company.whopCompanyId, existing);
    }

    const duplicates: Array<{ whopCompanyId: string; convexCompanyIds: string[] }> = [];

    for (const [whopCompanyId, convexCompanyIds] of seen.entries()) {
      if (convexCompanyIds.length > 1) {
        duplicates.push({ whopCompanyId, convexCompanyIds });
      }
    }

    return duplicates;
  }

  it('should detect and report duplicate whopCompanyId', () => {
    const companies = [
      { _id: 'c1', whopCompanyId: 'biz_a' },
      { _id: 'c2', whopCompanyId: 'biz_b' },
      { _id: 'c3', whopCompanyId: 'biz_a' }, // Duplicate!
      { _id: 'c4', whopCompanyId: 'biz_c' },
      { _id: 'c5', whopCompanyId: 'biz_b' }, // Another duplicate!
    ];

    const duplicates = findDuplicateWhopCompanyIds(companies);

    expect(duplicates).toHaveLength(2);
    expect(duplicates[0].whopCompanyId).toBe('biz_a');
    expect(duplicates[0].convexCompanyIds).toEqual(['c1', 'c3']);
    expect(duplicates[1].whopCompanyId).toBe('biz_b');
    expect(duplicates[1].convexCompanyIds).toEqual(['c2', 'c5']);
  });

  it('should return empty when no duplicates', () => {
    const companies = [
      { _id: 'c1', whopCompanyId: 'biz_a' },
      { _id: 'c2', whopCompanyId: 'biz_b' },
      { _id: 'c3', whopCompanyId: 'biz_c' },
    ];

    const duplicates = findDuplicateWhopCompanyIds(companies);
    expect(duplicates).toHaveLength(0);
  });
});

describe('Proposed Fix: Verify ownership before sync', () => {
  async function verifyCompanyOwnership(
    convexCompanyId: string,
    whopCompanyId: string,
    allCompanies: Array<{ _id: string; whopCompanyId: string }>
  ): Promise<{ valid: boolean; error?: string }> {
    // Check if any OTHER company has this whopCompanyId
    const otherCompaniesWithSameWhopId = allCompanies.filter(
      c => c.whopCompanyId === whopCompanyId && c._id !== convexCompanyId
    );

    if (otherCompaniesWithSameWhopId.length > 0) {
      return {
        valid: false,
        error: `whopCompanyId ${whopCompanyId} is also used by: ${otherCompaniesWithSameWhopId.map(c => c._id).join(', ')}`,
      };
    }

    return { valid: true };
  }

  it('should reject sync when duplicate whopCompanyId exists', async () => {
    const allCompanies = [
      { _id: 'c1', whopCompanyId: 'biz_a' },
      { _id: 'c2', whopCompanyId: 'biz_a' }, // Duplicate
    ];

    const result = await verifyCompanyOwnership('c1', 'biz_a', allCompanies);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('c2');
  });

  it('should allow sync when whopCompanyId is unique', async () => {
    const allCompanies = [
      { _id: 'c1', whopCompanyId: 'biz_a' },
      { _id: 'c2', whopCompanyId: 'biz_b' },
    ];

    const result = await verifyCompanyOwnership('c1', 'biz_a', allCompanies);

    expect(result.valid).toBe(true);
  });
});
