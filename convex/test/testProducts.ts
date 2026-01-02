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