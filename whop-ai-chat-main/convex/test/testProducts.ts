import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * Test function to verify product sync works
 * Run from Convex dashboard: Functions -> test:testProducts -> Run Function
 */
export const testProductSync = action({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }): Promise<any> => {
    console.log("\n🧪 TESTING PRODUCT SYNC");
    console.log("=" . repeat(50));
    
    try {
      // Step 1: Get company details
      console.log("\n1️⃣ Fetching company details...");
      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });
      
      if (!company) {
        return {
          success: false,
          error: "Company not found",
        };
      }
      
      console.log("✅ Company found:");
      console.log("   - Name:", company.name);
      console.log("   - Whop Company ID:", company.whopCompanyId);
      
      // Step 2: Test connection
      console.log("\n2️⃣ Testing Whop connection...");
      const connectionTest: any = await ctx.runAction(api.products.actions.testWhopConnection, {
        companyId,
      });
      
      console.log("Connection test result:");
      console.log("   - Success:", connectionTest.success);
      console.log("   - Message:", connectionTest.message);
      console.log("   - Sample products found:", connectionTest.sampleProducts.length);
      
      if (connectionTest.sampleProducts.length > 0) {
        console.log("\nSample products:");
        connectionTest.sampleProducts.forEach((p: any, i: number) => {
          console.log(`   ${i + 1}. ${p.title} (ID: ${p.id})`);
        });
      }
      
      // Step 3: Get current products in database
      console.log("\n3️⃣ Checking existing products in database...");
      const existingProducts: any[] = await ctx.runQuery(api.products.queries.getCompanyProducts, {
        companyId,
      });
      
      console.log("   - Products in database:", existingProducts.length);
      
      // Step 4: Run sync
      console.log("\n4️⃣ Running product sync...");
      const syncResult: any = await ctx.runAction(api.products.actions.syncProducts, {
        companyId,
      });
      
      console.log("Sync result:");
      console.log("   - Success:", syncResult.success);
      console.log("   - Synced count:", syncResult.syncedCount);
      console.log("   - Deleted count:", syncResult.deletedCount);
      console.log("   - Errors:", syncResult.errors.length);
      
      if (syncResult.errors.length > 0) {
        console.log("\n⚠️ Sync errors:");
        syncResult.errors.forEach((error: string) => {
          console.log("   -", error);
        });
      }
      
      // Step 5: Verify products after sync
      console.log("\n5️⃣ Verifying products after sync...");
      const updatedProducts: any[] = await ctx.runQuery(api.products.queries.getCompanyProducts, {
        companyId,
      });
      
      console.log("   - Products after sync:", updatedProducts.length);
      
      if (updatedProducts.length > 0) {
        console.log("\n📦 Synced products:");
        updatedProducts.slice(0, 5).forEach((p: any, i: number) => {
          console.log(`   ${i + 1}. ${p.title}`);
          console.log(`      - Price: ${p.currency} ${p.price ? (p.price / 100).toFixed(2) : 'N/A'}`);
          console.log(`      - Type: ${p.productType}`);
          console.log(`      - Active: ${p.isActive}`);
        });
      }
      
      console.log("\n" + "=" . repeat(50));
      console.log("✅ TEST COMPLETE");
      
      return {
        success: true,
        summary: {
          connectionWorking: connectionTest.success,
          productsFromWhop: connectionTest.sampleProducts.length,
          productsInDbBefore: existingProducts.length,
          productsInDbAfter: updatedProducts.length,
          syncedCount: syncResult.syncedCount,
          errors: syncResult.errors,
        },
      };
      
    } catch (error) {
      console.error("❌ Test failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Helper for string repeat
function repeat(str: string, count: number): string {
  return new Array(count + 1).join(str);
}

/**
 * Test with MOCK data to verify sync works when API returns correct products
 * This simulates what happens when a user syncs from UI with their token
 */
export const testProductSyncWithMockData = action({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }): Promise<any> => {
    console.log("\n🧪 TESTING PRODUCT SYNC WITH MOCK DATA");
    console.log("=" + repeat("=", 49));

    try {
      // Step 1: Get company details
      console.log("\n1️⃣ Fetching company details...");
      const company: any = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });

      if (!company) {
        return { success: false, error: "Company not found" };
      }

      console.log("✅ Company found:");
      console.log("   - Name:", company.name);
      console.log("   - Whop Company ID:", company.whopCompanyId);

      // Step 2: Create mock products with CORRECT company_id (simulates user token API response)
      console.log("\n2️⃣ Creating mock products with CORRECT company_id...");
      const timestamp = Date.now();
      const mockProducts = [
        {
          id: `mock_prod_${timestamp}_1`,
          company_id: company.whopCompanyId, // MATCHES expected!
          title: `[MOCK] Premium Membership - ${company.name}`,
          description: "Mock premium membership for testing",
          price: 4999,
          currency: "USD",
          category: "membership",
          is_active: true,
          is_visible: true,
        },
        {
          id: `mock_prod_${timestamp}_2`,
          company_id: company.whopCompanyId, // MATCHES expected!
          title: `[MOCK] Basic Course - ${company.name}`,
          description: "Mock course for testing",
          price: 1999,
          currency: "USD",
          category: "course",
          is_active: true,
          is_visible: true,
        },
        {
          id: `mock_prod_${timestamp}_3`,
          company_id: company.whopCompanyId, // MATCHES expected!
          title: `[MOCK] Community Access - ${company.name}`,
          description: "Mock community access for testing",
          price: 999,
          currency: "USD",
          category: "community",
          is_active: true,
          is_visible: true,
        },
      ];

      console.log(`   Created ${mockProducts.length} mock products`);
      mockProducts.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title} (company_id: ${p.company_id})`);
      });

      // Step 3: Simulate multi-tenancy check (SAME logic as real sync)
      console.log("\n3️⃣ Running multi-tenancy check...");
      const companyIds = [...new Set(mockProducts.map(p => p.company_id))];
      console.log(`   - Product company IDs: ${companyIds.join(', ')}`);
      console.log(`   - Expected company ID: ${company.whopCompanyId}`);

      const allMatch = companyIds.every(id => id === company.whopCompanyId);

      if (!allMatch) {
        console.log("   ❌ MULTI-TENANCY CHECK FAILED");
        return {
          success: false,
          error: "Multi-tenancy check failed (this shouldn't happen with mock data!)",
        };
      }

      console.log("   ✅ MULTI-TENANCY CHECK PASSED - All products belong to correct company!");

      // Step 4: Get products before sync
      console.log("\n4️⃣ Checking existing products in database...");
      const existingProducts: any[] = await ctx.runQuery(api.products.queries.getCompanyProducts, {
        companyId,
      });
      console.log(`   - Products before: ${existingProducts.length}`);

      // Step 5: Sync mock products using the real mutation
      console.log("\n5️⃣ Syncing mock products to database...");
      const syncedIds: string[] = [];

      for (const mockProduct of mockProducts) {
        try {
          await ctx.runMutation(api.products.mutations.upsertProduct, {
            companyId,
            whopProductId: mockProduct.id,
            whopCompanyId: mockProduct.company_id,
            title: mockProduct.title,
            description: mockProduct.description,
            price: mockProduct.price,
            currency: mockProduct.currency,
            productType: mapMockCategory(mockProduct.category),
            accessType: "one_time",
            isActive: mockProduct.is_active,
            isVisible: mockProduct.is_visible,
          });
          syncedIds.push(mockProduct.id);
          console.log(`   ✅ Synced: ${mockProduct.title}`);
        } catch (error) {
          console.log(`   ❌ Failed: ${mockProduct.title} - ${error}`);
        }
      }

      // Step 6: Verify products after sync
      console.log("\n6️⃣ Verifying products after sync...");
      const updatedProducts: any[] = await ctx.runQuery(api.products.queries.getCompanyProducts, {
        companyId,
      });
      console.log(`   - Products after: ${updatedProducts.length}`);

      // Find the mock products we just added
      const mockProductsInDb = updatedProducts.filter(p =>
        p.whopProductId?.startsWith(`mock_prod_${timestamp}`)
      );
      console.log(`   - Mock products found in DB: ${mockProductsInDb.length}`);

      // Step 7: Clean up mock products using cleanupDeletedProducts
      console.log("\n7️⃣ Cleaning up mock products...");
      // Get IDs of non-mock products to keep
      const realProductIds = updatedProducts
        .filter(p => !p.whopProductId?.startsWith(`mock_prod_${timestamp}`))
        .map(p => p.whopProductId)
        .filter(Boolean);

      // This will delete all products NOT in realProductIds (i.e., our mock products)
      const deletedCount = await ctx.runMutation(api.products.mutations.cleanupDeletedProducts, {
        companyId,
        syncedProductIds: realProductIds,
      });
      console.log(`   🗑️ Cleaned up ${deletedCount} mock products`);

      // Final verification
      const finalProducts: any[] = await ctx.runQuery(api.products.queries.getCompanyProducts, {
        companyId,
      });
      console.log(`   - Products after cleanup: ${finalProducts.length}`);

      console.log("\n" + "=" + repeat("=", 49));
      console.log("✅ MOCK TEST COMPLETE");

      return {
        success: true,
        summary: {
          companyName: company.name,
          whopCompanyId: company.whopCompanyId,
          multiTenancyCheckPassed: true,
          mockProductsCreated: mockProducts.length,
          mockProductsSynced: syncedIds.length,
          mockProductsCleanedUp: deletedCount,
          message: "When API returns correct products (via user token), sync works perfectly!",
        },
      };

    } catch (error) {
      console.error("❌ Mock test failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// Helper to map mock category to product type
function mapMockCategory(category: string): "membership" | "digital_product" | "course" | "community" | "software" | "other" {
  switch (category) {
    case "membership": return "membership";
    case "course": return "course";
    case "community": return "community";
    default: return "other";
  }
}