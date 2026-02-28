/**
 * Products Actions
 *
 * Actions for syncing products from Whop API.
 *
 * The old sync path relied on `sdk.products.list`, which omits `company_id`
 * and allowed ambiguous products to be assigned to the requested company.
 * This file now prefers access-pass based sources and validates legacy results
 * against the public access-pass detail endpoint before writing anything.
 */

"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api } from "../_generated/api";
import { getWhopConfig } from "../lib/whop";
import { WhopServerSdk } from "@whop/api";
import Whop from "@whop/sdk";

type SyncSource =
  | "access_passes_on_behalf_of"
  | "access_passes_app"
  | "legacy_products_public_verified"
  | "none";

type NormalizedProduct = {
  id: string;
  companyId: string;
  title: string;
  description: string;
  visibility: string;
  businessType?: string;
  category?: string;
  tags?: string[];
  imageUrl?: string;
  rawWhopData: any;
};

type ProductFetchResult = {
  source: SyncSource;
  products: NormalizedProduct[];
  errors: string[];
  hadSuccessfulSource: boolean;
};

function getBaseWhopServerSdk() {
  const { apiKey, appId } = getWhopConfig();
  return WhopServerSdk({ appApiKey: apiKey, appId });
}

function getOnBehalfOfSdk(whopUserId?: string) {
  const base = getBaseWhopServerSdk();
  return whopUserId ? base.withUser(whopUserId) : base;
}

function pickDescription(...parts: Array<string | null | undefined>) {
  const cleaned = parts
    .map((part) => (part || "").trim())
    .filter((part) => part.length > 0);

  const deduped: string[] = [];
  for (const part of cleaned) {
    if (!deduped.includes(part)) {
      deduped.push(part);
    }
  }

  return deduped.join("\n\n");
}

function isNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("not found") || message.includes("404");
}

function normalizeAccessPass(accessPass: any, companyId: string): NormalizedProduct {
  return {
    id: accessPass.id,
    companyId,
    title: accessPass.title || accessPass.name || "Untitled Product",
    description: pickDescription(
      accessPass.shortenedDescription,
      accessPass.headline,
      accessPass.creatorPitch,
      accessPass.description
    ),
    visibility: accessPass.visibility || "hidden",
    businessType: accessPass.type || accessPass.businessType,
    category: accessPass.category,
    tags: accessPass.tags || [],
    imageUrl:
      accessPass.logo?.sourceUrl ||
      accessPass.bannerImage?.source?.url ||
      accessPass.bannerImage?.sourceUrl ||
      undefined,
    rawWhopData: accessPass,
  };
}

async function listAccessPasses(
  sdk: ReturnType<typeof WhopServerSdk>,
  companyId: string
): Promise<NormalizedProduct[]> {
  const products: NormalizedProduct[] = [];
  let after: string | undefined;

  while (products.length < 500) {
    const response: any = await sdk.companies.listAccessPasses({
      companyId,
      first: 100,
      ...(after ? { after } : {}),
    } as any);

    const nodes = response?.accessPasses?.nodes || [];
    for (const node of nodes) {
      products.push(normalizeAccessPass(node, companyId));
      if (products.length >= 500) break;
    }

    const pageInfo = response?.accessPasses?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor || nodes.length === 0) {
      break;
    }
    after = pageInfo.endCursor;
  }

  return products;
}

async function listLegacyProducts(companyId: string) {
  const { apiKey, appId } = getWhopConfig();
  const sdk = new Whop({ apiKey, appID: appId });
  const products: any[] = [];

  for await (const product of sdk.products.list({
    company_id: companyId,
    product_types: ["regular"],
  })) {
    products.push(product);
    if (products.length >= 500) break;
  }

  return products;
}

async function verifyLegacyProduct(
  publicSdk: ReturnType<typeof WhopServerSdk>,
  companyId: string,
  legacyProduct: any
): Promise<NormalizedProduct | null> {
  try {
    const accessPass: any = await publicSdk.accessPasses.getAccessPass({
      accessPassId: legacyProduct.id,
    });

    if (accessPass?.company?.id !== companyId) {
      return null;
    }

    return {
      id: legacyProduct.id,
      companyId,
      title: accessPass.title || legacyProduct.title || legacyProduct.name || "Untitled Product",
      description: pickDescription(
        accessPass.shortenedDescription,
        accessPass.headline,
        legacyProduct.headline,
        legacyProduct.description
      ),
      visibility: accessPass.visibility || legacyProduct.visibility || "hidden",
      businessType: legacyProduct.business_type || legacyProduct.type,
      category: legacyProduct.category,
      tags: legacyProduct.tags || [],
      imageUrl:
        accessPass.logo?.sourceUrl ||
        legacyProduct.image_url ||
        legacyProduct.image ||
        legacyProduct.thumbnail ||
        undefined,
      rawWhopData: {
        ...legacyProduct,
        publicAccessPass: accessPass,
      },
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function fetchProductsForSync(
  companyId: string,
  whopUserId?: string
): Promise<ProductFetchResult> {
  const errors: string[] = [];

  if (whopUserId) {
    try {
      const products = await listAccessPasses(getOnBehalfOfSdk(whopUserId), companyId);
      return {
        source: "access_passes_on_behalf_of",
        products,
        errors,
        hadSuccessfulSource: true,
      };
    } catch (error) {
      errors.push(`On-behalf-of access pass sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const products = await listAccessPasses(getBaseWhopServerSdk(), companyId);
    return {
      source: "access_passes_app",
      products,
      errors,
      hadSuccessfulSource: true,
    };
  } catch (error) {
    errors.push(`App-key access pass sync failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const publicSdk = getBaseWhopServerSdk();
    const legacyProducts = await listLegacyProducts(companyId);
    const verifiedProducts: NormalizedProduct[] = [];

    for (const legacyProduct of legacyProducts) {
      try {
        const verified = await verifyLegacyProduct(publicSdk, companyId, legacyProduct);
        if (verified) {
          verifiedProducts.push(verified);
        }
      } catch (error) {
        errors.push(
          `Failed to validate legacy product ${legacyProduct.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (verifiedProducts.length > 0) {
      return {
        source: "legacy_products_public_verified",
        products: verifiedProducts,
        errors,
        hadSuccessfulSource: true,
      };
    }

    errors.push("Legacy product sync returned no company-verified products.");
  } catch (error) {
    errors.push(`Legacy product sync failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    source: "none",
    products: [],
    errors,
    hadSuccessfulSource: false,
  };
}

async function sanitizeStoredCatalog(
  ctx: any,
  companyId: string,
  whopCompanyId: string
): Promise<{ deletedProducts: number; deletedPlans: number }> {
  const existingProducts = await ctx.runQuery(api.products.queries.getCompanyProducts, {
    companyId,
    includeHidden: true,
    includeInactive: true,
  });

  if (existingProducts.length === 0) {
    return { deletedProducts: 0, deletedPlans: 0 };
  }

  const publicSdk = getBaseWhopServerSdk();
  const verifiedProductIds: string[] = [];

  for (const product of existingProducts) {
    try {
      const accessPass: any = await publicSdk.accessPasses.getAccessPass({
        accessPassId: product.whopProductId,
      });

      if (accessPass?.company?.id === whopCompanyId) {
        verifiedProductIds.push(product.whopProductId);
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        // Keep unknown rows on transient failures. We only want to delete rows we can prove are wrong.
        verifiedProductIds.push(product.whopProductId);
      }
    }
  }

  const deletedProducts = await ctx.runMutation(api.products.mutations.cleanupDeletedProducts, {
    companyId,
    syncedProductIds: verifiedProductIds,
  });

  const planCleanup = await ctx.runMutation(api.whopPlans.mutations.cleanupPlansForProducts, {
    companyId,
    activeWhopProductIds: verifiedProductIds,
  });

  return {
    deletedProducts,
    deletedPlans: planCleanup.deletedCount,
  };
}

/**
 * Sync all products from Whop for a company.
 *
 * `whopUserId` is the preferred auth input. It lets the Whop server SDK query
 * company access passes on behalf of the currently authenticated user.
 */
export const syncProducts = action({
  args: {
    companyId: v.id("companies"),
    userToken: v.optional(v.string()),
    whopUserId: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, userToken, whopUserId }): Promise<any> => {
    console.log(
      `[syncProducts] Starting sync for company: ${companyId}, hasUserToken: ${!!userToken}, hasWhopUserId: ${!!whopUserId}`
    );

    try {
      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!company.whopCompanyId) {
        throw new Error("No Whop company ID found for this company");
      }

      const uniquenessCheck = await ctx.runQuery(
        api.companies.queries.verifyWhopCompanyIdUnique,
        { companyId }
      );

      if (!uniquenessCheck.valid) {
        return {
          success: false,
          syncedCount: 0,
          deletedCount: 0,
          errors: [
            `Data integrity error: ${uniquenessCheck.error}. Resolve duplicate whopCompanyIds before syncing.`,
          ],
        };
      }

      const sanitation = await sanitizeStoredCatalog(ctx, companyId, company.whopCompanyId);
      console.log(`[syncProducts] Sanitized existing catalog`, sanitation);

      await ctx.runMutation(api.products.mutations.markProductsAsOutdated, { companyId });

      const fetchResult = await fetchProductsForSync(company.whopCompanyId, whopUserId);
      console.log(`[syncProducts] Product source: ${fetchResult.source}, fetched: ${fetchResult.products.length}`);

      if (!fetchResult.hadSuccessfulSource) {
        return {
          success: false,
          syncedCount: 0,
          deletedCount: sanitation.deletedProducts,
          errors: fetchResult.errors,
        };
      }

      const excludedProductIds = company.excludedProductIds || [];
      const syncedProductIds: string[] = [];
      const errors = [...fetchResult.errors];
      let skippedArchived = 0;
      let skippedExcluded = 0;

      for (const whopProduct of fetchResult.products) {
        if (!whopProduct) continue;

        if (excludedProductIds.includes(whopProduct.id)) {
          skippedExcluded++;
          continue;
        }

        if (whopProduct.visibility === "archived" || whopProduct.visibility === "quick_link") {
          skippedArchived++;
          continue;
        }

        try {
          const productId = await syncSingleProduct(ctx, companyId, company.whopCompanyId, whopProduct);
          syncedProductIds.push(whopProduct.id);
          console.log(`[syncProducts] Synced product: ${whopProduct.id} -> ${productId}`);
        } catch (error) {
          const errorMsg = `Failed to sync product ${whopProduct.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`[syncProducts] ${errorMsg}`);
        }
      }

      const deletedProducts = await ctx.runMutation(api.products.mutations.cleanupDeletedProducts, {
        companyId,
        syncedProductIds,
      });

      const deletedPlans = await ctx.runMutation(api.whopPlans.mutations.cleanupPlansForProducts, {
        companyId,
        activeWhopProductIds: syncedProductIds,
      });

      let syncedPlans = 0;
      let totalDeletedPlans = sanitation.deletedPlans + deletedPlans.deletedCount;
      try {
        const plansSyncResult = await ctx.runAction(api.whopPlans.actions.syncPlans, {
          companyId,
          whopUserId,
        });

        syncedPlans = plansSyncResult.syncedCount;
        totalDeletedPlans += plansSyncResult.deletedCount;
        if (plansSyncResult.errors.length > 0) {
          errors.push(...plansSyncResult.errors);
        }
      } catch (error) {
        errors.push(`Plans sync failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      return {
        success: errors.length === 0,
        syncedCount: syncedProductIds.length,
        deletedCount: sanitation.deletedProducts + deletedProducts,
        deletedPlans: totalDeletedPlans,
        syncedPlans,
        skippedArchived,
        skippedExcluded,
        source: fetchResult.source,
        errors,
      };
    } catch (error) {
      console.error(`[syncProducts] Sync failed:`, error);
      return {
        success: false,
        syncedCount: 0,
        deletedCount: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  },
});

async function syncSingleProduct(
  ctx: any,
  companyId: string,
  whopCompanyId: string,
  whopProduct: NormalizedProduct
) {
  if (whopProduct.companyId !== whopCompanyId) {
    throw new Error(
      `Product ${whopProduct.id} belongs to company ${whopProduct.companyId}, not ${whopCompanyId}.`
    );
  }

  const description = whopProduct.description || "";

  const productData = {
    companyId,
    whopProductId: whopProduct.id,
    whopCompanyId,
    title: whopProduct.title,
    description,
    price: undefined,
    currency: "USD",
    productType: mapWhopProductType(whopProduct.businessType || whopProduct.category),
    accessType: mapWhopAccessType(whopProduct.rawWhopData),
    billingPeriod: mapWhopBillingPeriod(whopProduct.rawWhopData),
    isActive: whopProduct.visibility !== "archived",
    isVisible: whopProduct.visibility === "visible",
    category: whopProduct.category || whopProduct.businessType,
    tags: whopProduct.tags || [],
    imageUrl: whopProduct.imageUrl,
    features: extractFeaturesFromText(description),
    benefits: extractBenefitsFromText(description),
    targetAudience: whopProduct.rawWhopData?.targetAudience || whopProduct.rawWhopData?.audience,
    rawWhopData: whopProduct.rawWhopData,
  };

  return await ctx.runMutation(api.products.mutations.upsertProduct, productData);
}

function mapWhopProductType(
  whopType: string | undefined
): "membership" | "digital_product" | "course" | "community" | "software" | "other" {
  if (!whopType) return "other";

  const type = whopType.toLowerCase();

  if (type.includes("membership") || type.includes("subscription")) return "membership";
  if (type.includes("course") || type.includes("training") || type.includes("education")) return "course";
  if (type.includes("community") || type.includes("discord") || type.includes("telegram")) return "community";
  if (type.includes("software") || type.includes("app") || type.includes("tool")) return "software";
  if (type.includes("digital") || type.includes("download") || type.includes("ebook") || type.includes("template")) {
    return "digital_product";
  }

  return "other";
}

function mapWhopAccessType(whopProduct: any): "one_time" | "subscription" | "lifetime" {
  if (
    whopProduct?.recurring ||
    whopProduct?.subscription ||
    whopProduct?.billing_period ||
    whopProduct?.interval
  ) {
    return "subscription";
  }

  if (
    whopProduct?.lifetime ||
    whopProduct?.permanent ||
    (whopProduct?.access_type && String(whopProduct.access_type).toLowerCase().includes("lifetime"))
  ) {
    return "lifetime";
  }

  return "one_time";
}

function mapWhopBillingPeriod(
  whopProduct: any
): "monthly" | "yearly" | "weekly" | "daily" | undefined {
  const period = whopProduct?.billing_period || whopProduct?.interval || whopProduct?.frequency;
  if (!period) return undefined;

  const periodStr = String(period).toLowerCase();
  if (periodStr.includes("month")) return "monthly";
  if (periodStr.includes("year") || periodStr.includes("annual")) return "yearly";
  if (periodStr.includes("week")) return "weekly";
  if (periodStr.includes("day")) return "daily";
  return undefined;
}

function extractFeaturesFromText(description: string | undefined): string[] {
  if (!description) return [];

  const features: string[] = [];
  const bulletPoints = description.match(/[•\-\*]\s*([^\n\r]+)/g);
  if (bulletPoints) {
    features.push(...bulletPoints.map((point) => point.replace(/[•\-\*]\s*/, "").trim()));
  }

  const featuresMatch = description.match(/features?:\s*\n?(.*?)(?:\n\n|benefits?:|$)/i);
  if (featuresMatch?.[1]) {
    const featureLines = featuresMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 10);
    features.push(...featureLines);
  }

  return [...new Set(features)];
}

function extractBenefitsFromText(description: string | undefined): string[] {
  if (!description) return [];

  const benefits: string[] = [];
  const benefitsMatch = description.match(/benefits?:\s*\n?(.*?)(?:\n\n|features?:|$)/i);
  if (benefitsMatch?.[1]) {
    const benefitLines = benefitsMatch[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 10);
    benefits.push(...benefitLines);
  }

  return [...new Set(benefits)];
}

export const testWhopConnection = action({
  args: {
    companyId: v.id("companies"),
    userToken: v.optional(v.string()),
    whopUserId: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, userToken, whopUserId }): Promise<any> => {
    try {
      const company: any = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });

      if (!company || !company.whopCompanyId) {
        throw new Error("Company not found or missing Whop company ID");
      }

      const result = await fetchProductsForSync(company.whopCompanyId, whopUserId);

      return {
        success: result.hadSuccessfulSource,
        message: result.hadSuccessfulSource
          ? `Fetched ${result.products.length} products using ${result.source}`
          : result.errors[0] || "Failed to connect to Whop",
        companyId: company.whopCompanyId,
        tokenType: whopUserId
          ? "ON_BEHALF_OF_USER"
          : userToken
            ? "RAW_TOKEN_UNUSED_NEEDS_WHOOP_USER_ID"
            : "APP_KEY_OR_LEGACY_FALLBACK",
        source: result.source,
        sampleProducts: result.products.slice(0, 10).map((product) => ({
          id: product.id,
          title: product.title,
          visible: product.visibility,
          company_id: product.companyId,
        })),
        errors: result.errors,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Whop: ${error instanceof Error ? error.message : String(error)}`,
        sampleProducts: [],
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  },
});

export const syncAllCompaniesProducts = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    totalCompanies: number;
    successCount: number;
    errorCount: number;
    errors: string[];
  }> => {
    console.log("[syncAllCompaniesProducts] Starting scheduled product sync...");

    try {
      const companies = await ctx.runQuery(api.companies.queries.getAllCompanies, {});
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const company of companies) {
        try {
          const result = await ctx.runAction(api.products.actions.syncProducts, {
            companyId: company._id,
          });

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Company ${company.name}: ${result.errors.join(", ")}`);
          }
        } catch (error) {
          errorCount++;
          errors.push(`Company ${company.name}: ${error instanceof Error ? error.message : String(error)}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return {
        totalCompanies: companies.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10),
      };
    } catch (error) {
      return {
        totalCompanies: 0,
        successCount: 0,
        errorCount: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  },
});
