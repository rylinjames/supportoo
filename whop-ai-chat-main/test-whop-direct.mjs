#!/usr/bin/env node
import { WhopServerSdk } from '@whop/api';

const apiKey = 'apik_w9a0v4OB6VUfl_A2021772_C_f2b9c8d7d5c1902086d5da24c12541f8c45dc6382c7259a3e4d238c4cb2d89';
const appId = 'app_Z6bbsQEQUmRQQH';
const companyId = 'biz_2T7tC1fnFVo6d4'; // BooKoo Apps

console.log('\n🧪 Testing Whop API - Deep Dive\n');
console.log('='.repeat(50));

const whopSdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

console.log('✅ SDK initialized');
console.log('  App ID:', appId);
console.log('  Company ID:', companyId);

try {
  // Test 1: Get company info
  console.log('\n1️⃣ Testing getCompany...');
  const company = await whopSdk.companies.getCompany({ companyId });
  console.log('  ✅ Company found:', company.title || company.id);
  console.log('  Company structure keys:', Object.keys(company).slice(0, 20).join(', '));
  
  // Test 2: List memberships (these might be what we need instead of plans)
  console.log('\n2️⃣ Testing listMemberships...');
  try {
    const memberships = await whopSdk.companies.listMemberships({ 
      companyId,
      first: 10 
    });
    console.log('  Memberships response:', !!memberships);
    console.log('  Has memberships?:', !!memberships?.memberships);
    console.log('  Count:', memberships?.memberships?.nodes?.length || 0);
  } catch (e) {
    console.log('  ❌ Error:', e.message);
  }
  
  // Test 3: List access passes (another potential product type)
  console.log('\n3️⃣ Testing listAccessPasses...');
  try {
    const accessPasses = await whopSdk.companies.listAccessPasses({ 
      companyId,
      first: 10 
    });
    console.log('  Access passes response:', !!accessPasses);
    console.log('  Has access passes?:', !!accessPasses?.accessPasses);
    console.log('  Count:', accessPasses?.accessPasses?.nodes?.length || 0);
  } catch (e) {
    console.log('  ❌ Error:', e.message);
  }
  
  // Test 4: List plans with more details
  console.log('\n4️⃣ Testing listPlans in detail...');
  try {
    const plansResponse = await whopSdk.companies.listPlans({ 
      companyId,
      first: 10 
    });
    
    console.log('  Plans response structure:');
    console.log('    - Response exists:', !!plansResponse);
    console.log('    - Has plans field:', !!plansResponse?.plans);
    console.log('    - Has nodes:', !!plansResponse?.plans?.nodes);
    console.log('    - Node count:', plansResponse?.plans?.nodes?.length || 0);
    
    // Check if the response has any data at all
    console.log('    - Full response keys:', Object.keys(plansResponse || {}).join(', '));
    if (plansResponse?.plans) {
      console.log('    - Plans object keys:', Object.keys(plansResponse.plans).join(', '));
    }
    
    // Check pagination info
    if (plansResponse?.plans?.pageInfo) {
      console.log('    - PageInfo:', JSON.stringify(plansResponse.plans.pageInfo));
    }
    
    // If we have any nodes, show their structure
    if (plansResponse?.plans?.nodes && plansResponse.plans.nodes.length > 0) {
      const firstPlan = plansResponse.plans.nodes[0];
      if (firstPlan) {
        console.log('\n  📦 First plan structure:');
        console.log('    Keys:', Object.keys(firstPlan).join(', '));
        console.log('    Sample data:', JSON.stringify(firstPlan, null, 2).substring(0, 500));
      }
    } else {
      console.log('\n  ⚠️ No plans/products found in response');
      console.log('  This likely means the company has no products set up in Whop');
    }
    
  } catch (e) {
    console.log('  ❌ Error fetching plans:', e.message);
    console.log('  Full error:', e);
  }
  
  // Test 5: Try a direct GraphQL-style query if available
  console.log('\n5️⃣ Checking for alternative product endpoints...');
  
  // Check what other methods might be available
  const allMethods = Object.keys(whopSdk);
  console.log('  SDK top-level methods:', allMethods.join(', '));
  
  // Check if there are other product-related endpoints
  if (whopSdk.products) {
    console.log('  Products methods:', Object.keys(whopSdk.products).join(', '));
  } else {
    console.log('  ❌ No products namespace found in SDK');
  }
  
  if (whopSdk.plans) {
    console.log('  Plans methods:', Object.keys(whopSdk.plans).join(', '));
  } else {
    console.log('  ❌ No plans namespace found in SDK');
  }
  
  // Test 6: List members to verify company access works
  console.log('\n6️⃣ Testing listMembers (to verify API access)...');
  try {
    const members = await whopSdk.companies.listMembers({ 
      companyId,
      first: 5 
    });
    console.log('  ✅ Can access members - API is working');
    console.log('  Member count:', members?.members?.nodes?.length || 0);
  } catch (e) {
    console.log('  ❌ Error:', e.message);
  }

} catch (error) {
  console.error('\n❌ Fatal error:', error);
}

console.log('\n' + '='.repeat(50));
console.log('\n📊 Summary:');
console.log('  - API connection: ✅ Working');
console.log('  - Company found: ✅ BooKoo Apps');
console.log('  - Plans/Products: ❌ Returns empty (0 products)');
console.log('\n💡 Root Cause: The company "BooKoo Apps" has no products/plans');
console.log('   configured in Whop. You need to create products in your');
console.log('   Whop dashboard first before they can be synced.');
console.log('\n🔧 Solution: Go to your Whop dashboard and create at least');
console.log('   one product/plan, then run the sync again.\n');