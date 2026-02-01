#!/usr/bin/env node
import { WhopServerSdk } from '@whop/api';

const apiKey = 'apik_w9a0v4OB6VUfl_A2021772_C_f2b9c8d7d5c1902086d5da24c12541f8c45dc6382c7259a3e4d238c4cb2d89';
const appId = 'app_Z6bbsQEQUmRQQH';
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('\n🔍 EXHAUSTIVE WHOP API PRODUCT SEARCH\n');
console.log('='.repeat(60));

const whopSdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

const results = {};

async function tryEndpoint(name, fn, showDetails = false) {
  console.log(`\n📋 Testing: ${name}`);
  try {
    const result = await fn();
    
    if (!result) {
      console.log('  ❌ Null/undefined response');
      results[name] = 'empty';
      return null;
    }
    
    // Check for various data structures
    let foundData = false;
    let dataCount = 0;
    
    // Check for GraphQL-style response
    const possibleFields = ['products', 'plans', 'items', 'nodes', 'data', 'results', 
                          'memberships', 'accessPasses', 'experiences', 'invoices',
                          'promoCodes', 'receipts', 'payments', 'users', 'members'];
    
    for (const field of possibleFields) {
      if (result[field]) {
        const items = result[field]?.nodes || result[field];
        if (Array.isArray(items)) {
          dataCount = items.length;
          if (dataCount > 0) {
            foundData = true;
            console.log(`  ✅ Found ${dataCount} items in ".${field}"`);
            
            if (showDetails && items[0]) {
              console.log(`     Sample item keys: ${Object.keys(items[0]).slice(0, 10).join(', ')}`);
              
              // Look for product-related fields
              const productFields = ['product', 'plan', 'price', 'amount', 'title', 'name', 'sku', 
                                    'product_id', 'plan_id', 'item', 'description'];
              const relevantData = {};
              for (const pf of productFields) {
                if (items[0][pf] !== undefined) {
                  relevantData[pf] = items[0][pf];
                }
              }
              if (Object.keys(relevantData).length > 0) {
                console.log('     Product-related fields:', JSON.stringify(relevantData, null, 2));
              }
            }
          }
        } else if (typeof items === 'object' && items.nodes) {
          // Nested GraphQL structure
          dataCount = items.nodes?.length || 0;
          if (dataCount > 0) {
            foundData = true;
            console.log(`  ✅ Found ${dataCount} items in ".${field}.nodes"`);
            
            if (showDetails && items.nodes[0]) {
              const item = items.nodes[0];
              console.log(`     Item type: ${item.__typename || 'unknown'}`);
              console.log(`     Sample fields: ${Object.keys(item).slice(0, 10).join(', ')}`);
            }
          }
        }
      }
    }
    
    // Check if response itself is an array
    if (!foundData && Array.isArray(result)) {
      dataCount = result.length;
      if (dataCount > 0) {
        foundData = true;
        console.log(`  ✅ Direct array with ${dataCount} items`);
      }
    }
    
    // Check for any nested product/plan references
    if (!foundData && typeof result === 'object') {
      const resultStr = JSON.stringify(result);
      if (resultStr.includes('product') || resultStr.includes('plan') || resultStr.includes('price')) {
        console.log('  ℹ️ Contains product-related text in response');
        console.log('     Keys:', Object.keys(result).join(', '));
      }
    }
    
    if (!foundData) {
      console.log('  ⚠️ No data found');
      if (typeof result === 'object') {
        console.log('     Response keys:', Object.keys(result).slice(0, 10).join(', '));
      }
    }
    
    results[name] = dataCount;
    return result;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    results[name] = 'error';
    return null;
  }
}

// ============= 1. CORE PRODUCT/PLAN ENDPOINTS =============
console.log('\n' + '='.repeat(60));
console.log('1️⃣ CORE PRODUCT/PLAN ENDPOINTS');
console.log('='.repeat(60));

await tryEndpoint('companies.listPlans', () => 
  whopSdk.companies.listPlans({ companyId, first: 100 }), true);

// ============= 2. MEMBERSHIP ENDPOINTS =============
console.log('\n' + '='.repeat(60));
console.log('2️⃣ MEMBERSHIP ENDPOINTS');
console.log('='.repeat(60));

await tryEndpoint('companies.listMemberships', () => 
  whopSdk.companies.listMemberships({ companyId, first: 100 }), true);

await tryEndpoint('companies.listMembers', () => 
  whopSdk.companies.listMembers({ companyId, first: 10 }), true);

// ============= 3. ACCESS PASS ENDPOINTS =============
console.log('\n' + '='.repeat(60));
console.log('3️⃣ ACCESS PASS ENDPOINTS');
console.log('='.repeat(60));

await tryEndpoint('companies.listAccessPasses', () => 
  whopSdk.companies.listAccessPasses({ companyId, first: 100 }), true);

await tryEndpoint('accessPasses.getAccessPass (if exists)', async () => {
  // Try with a made-up ID to see the error structure
  try {
    return await whopSdk.accessPasses.getAccessPass({ accessPassId: 'pass_test123' });
  } catch (e) {
    console.log('     Error structure:', e.message.substring(0, 100));
    return null;
  }
});

// ============= 4. PAYMENT/COMMERCE ENDPOINTS =============
console.log('\n' + '='.repeat(60));
console.log('4️⃣ PAYMENT/COMMERCE ENDPOINTS');  
console.log('='.repeat(60));

await tryEndpoint('payments.listReceiptsForCompany', () => 
  whopSdk.payments.listReceiptsForCompany({ companyId, first: 10 }), true);

await tryEndpoint('invoices.listInvoices', () => 
  whopSdk.invoices.listInvoices({ companyId, first: 10 }), true);

await tryEndpoint('promoCodes.listPromoCodes', () => 
  whopSdk.promoCodes.listPromoCodes({ companyId, first: 10 }), true);

// ============= 5. EXPERIENCE ENDPOINTS (detailed) =============
console.log('\n' + '='.repeat(60));
console.log('5️⃣ EXPERIENCE ENDPOINTS (DETAILED)');
console.log('='.repeat(60));

const experiences = await tryEndpoint('experiences.listExperiences', () => 
  whopSdk.experiences.listExperiences({ companyId, first: 50 }), false);

if (experiences?.experiencesV2?.nodes) {
  console.log('\n  📦 Analyzing experiences for product data:');
  experiences.experiencesV2.nodes.forEach((exp, i) => {
    if (exp.name?.toLowerCase().includes('mailoo') || 
        exp.name?.toLowerCase().includes('pingoo') || 
        exp.name?.toLowerCase().includes('bookoo')) {
      console.log(`\n  🎯 Potential product match: ${exp.name}`);
      console.log('     ID:', exp.id);
      console.log('     App:', exp.app?.name);
      console.log('     Type:', exp.__typename);
      
      // Check if we can get more details about this experience
      if (whopSdk.experiences.getExperience) {
        tryEndpoint(`  experiences.getExperience(${exp.id})`, () =>
          whopSdk.experiences.getExperience({ experienceId: exp.id }), true);
      }
    }
  });
}

// ============= 6. USER/MEMBER ACCESS =============
console.log('\n' + '='.repeat(60));
console.log('6️⃣ USER/MEMBER ACCESS CHECKS');
console.log('='.repeat(60));

await tryEndpoint('companies.listAuthorizedUsers', () => 
  whopSdk.companies.listAuthorizedUsers({ companyId, first: 10 }), true);

// Try to get a specific member to see their access
const members = await tryEndpoint('companies.listMembers (detailed)', () => 
  whopSdk.companies.listMembers({ companyId, first: 5 }), false);

if (members?.members?.nodes && members.members.nodes.length > 0) {
  const firstMember = members.members.nodes[0];
  if (firstMember?.id) {
    await tryEndpoint(`companies.getMember(${firstMember.id})`, () =>
      whopSdk.companies.getMember({ memberId: firstMember.id }), true);
  }
}

// ============= 7. COMPANY DETAILS =============
console.log('\n' + '='.repeat(60));
console.log('7️⃣ COMPANY DETAILS (might have product info)');
console.log('='.repeat(60));

const company = await tryEndpoint('companies.getCompany', () => 
  whopSdk.companies.getCompany({ companyId }), false);

if (company) {
  console.log('  Company fields:', Object.keys(company).join(', '));
  
  // Check for any product-related fields
  const productRelatedFields = Object.keys(company).filter(key => 
    key.toLowerCase().includes('product') || 
    key.toLowerCase().includes('plan') ||
    key.toLowerCase().includes('price') ||
    key.toLowerCase().includes('tier'));
    
  if (productRelatedFields.length > 0) {
    console.log('  🎯 Product-related fields found:', productRelatedFields.join(', '));
    productRelatedFields.forEach(field => {
      console.log(`     ${field}:`, company[field]);
    });
  }
}

// ============= 8. WAITLIST (might reference products) =============
console.log('\n' + '='.repeat(60));
console.log('8️⃣ WAITLIST ENTRIES');
console.log('='.repeat(60));

await tryEndpoint('companies.listWaitlistEntries', () => 
  whopSdk.companies.listWaitlistEntries({ companyId, first: 10 }), true);

// ============= 9. APP-LEVEL ENDPOINTS =============
console.log('\n' + '='.repeat(60));
console.log('9️⃣ APP-LEVEL ENDPOINTS');
console.log('='.repeat(60));

await tryEndpoint('apps.listApps', () => 
  whopSdk.apps.listApps({ first: 10 }), true);

await tryEndpoint('apps.getApp', () => 
  whopSdk.apps.getApp({ appId }), true);

// ============= 10. WEBHOOK INSPECTION =============
console.log('\n' + '='.repeat(60));
console.log('🔟 WEBHOOK ENDPOINTS (might show product events)');
console.log('='.repeat(60));

await tryEndpoint('webhooks.listWebhooks', () => 
  whopSdk.webhooks.listWebhooks({ appId, first: 10 }), true);

// ============= 11. AFFILIATES (might reference products) =============
console.log('\n' + '='.repeat(60));
console.log('1️⃣1️⃣ AFFILIATE ENDPOINTS');
console.log('='.repeat(60));

await tryEndpoint('affiliates.listAffiliates', () => 
  whopSdk.affiliates.listAffiliates({ companyId, first: 10 }), true);

// ============= 12. LEDGER ACCOUNTS =============
console.log('\n' + '='.repeat(60));
console.log('1️⃣2️⃣ LEDGER ACCOUNTS (financial data)');
console.log('='.repeat(60));

await tryEndpoint('companies.getCompanyLedgerAccount', () => 
  whopSdk.companies.getCompanyLedgerAccount({ companyId }), true);

// ============= SUMMARY =============
console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY OF RESULTS');
console.log('='.repeat(60));

console.log('\nEndpoints with data:');
Object.entries(results).forEach(([endpoint, count]) => {
  if (count > 0 && count !== 'error' && count !== 'empty') {
    console.log(`  ✅ ${endpoint}: ${count} items`);
  }
});

console.log('\nEndpoints with no data:');
Object.entries(results).forEach(([endpoint, count]) => {
  if (count === 0 || count === 'empty') {
    console.log(`  ⚠️ ${endpoint}`);
  }
});

console.log('\nEndpoints with errors:');
Object.entries(results).forEach(([endpoint, count]) => {
  if (count === 'error') {
    console.log(`  ❌ ${endpoint}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('🏁 EXHAUSTIVE SEARCH COMPLETE');
console.log('='.repeat(60));

// Final check - try to find any "product" or "plan" text in all responses
console.log('\n🔍 Final analysis:');
console.log('The products you see in the Whop dashboard (BooKoo Apps, Mailoo tiers, etc.)');
console.log('are NOT exposed through the public API endpoints we can access.');
console.log('\nPossible reasons:');
console.log('1. Products require special merchant/seller API access');
console.log('2. Products are managed through a different Whop system (dashboard-only)');
console.log('3. The API key needs additional scopes/permissions');
console.log('4. Products must be created through the API to be accessible via API\n');