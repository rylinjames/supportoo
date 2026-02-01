#!/usr/bin/env node

/**
 * Test script to verify Whop product sync functionality
 * Run with: node test-whop-products.js
 */

require('dotenv').config({ path: '.env.local' });

async function testWhopProducts() {
  console.log('\n🧪 Testing Whop Products API Integration\n');
  console.log('=' . repeat(50));

  // Check environment variables
  const apiKey = process.env.WHOP_API_KEY;
  const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
  
  if (!apiKey || !appId) {
    console.error('❌ Missing required environment variables:');
    console.error('   WHOP_API_KEY:', apiKey ? '✅ Set' : '❌ Missing');
    console.error('   NEXT_PUBLIC_WHOP_APP_ID:', appId ? '✅ Set' : '❌ Missing');
    console.error('\nPlease check your .env.local file');
    process.exit(1);
  }

  console.log('✅ Environment variables found');
  console.log('   App ID:', appId);
  console.log('   API Key:', apiKey.substring(0, 10) + '...');

  try {
    // Import the Whop SDK
    const { WhopServerSdk } = require('@whop/api');
    
    const whopSdk = WhopServerSdk({
      appApiKey: apiKey,
      appId: appId,
    });

    console.log('\n📋 Testing Whop SDK Methods:');
    console.log('-' . repeat(50));

    // Test 1: List available SDK methods
    console.log('\n1️⃣ Available company methods:');
    const companyMethods = Object.keys(whopSdk.companies || {});
    companyMethods.forEach(method => {
      console.log('   - companies.' + method + '()');
    });

    // Test 2: Try to fetch a test company's plans
    // You'll need to replace this with an actual company ID from your Whop account
    const testCompanyId = process.env.TEST_WHOP_COMPANY_ID || 'comp_2Vfo0s5j33qyq'; // Replace with your company ID
    
    console.log('\n2️⃣ Testing listPlans for company:', testCompanyId);
    
    try {
      const response = await whopSdk.companies.listPlans({
        companyId: testCompanyId,
        first: 5, // Get first 5 plans
      });

      console.log('\n✅ Successfully fetched plans!');
      console.log('   Response structure:');
      console.log('   - Has response:', !!response);
      console.log('   - Has plans:', !!response?.plans);
      console.log('   - Has nodes:', !!response?.plans?.nodes);
      console.log('   - Node count:', response?.plans?.nodes?.length || 0);
      
      if (response?.plans?.nodes && response.plans.nodes.length > 0) {
        console.log('\n📦 Found Plans/Products:');
        response.plans.nodes.forEach((plan, index) => {
          if (!plan) return;
          console.log(`\n   Product ${index + 1}:`);
          console.log('   - ID:', plan.id);
          console.log('   - Title:', plan.title || plan.name || 'N/A');
          console.log('   - Price:', plan.price || 'N/A');
          console.log('   - Type:', plan.type || 'N/A');
          console.log('   - Keys available:', Object.keys(plan).join(', '));
        });
        
        // Show the structure of the first plan for debugging
        if (response.plans.nodes[0]) {
          console.log('\n🔍 First plan full structure (for debugging):');
          console.log(JSON.stringify(response.plans.nodes[0], null, 2));
        }
      } else {
        console.log('\n⚠️  No plans found for this company');
        console.log('   This could mean:');
        console.log('   - The company has no products/plans set up');
        console.log('   - The company ID is incorrect');
        console.log('   - There\'s a permissions issue');
      }

      // Test pagination info
      if (response?.plans?.pageInfo) {
        console.log('\n📄 Pagination info:');
        console.log('   - Has next page:', response.plans.pageInfo.hasNextPage);
        console.log('   - End cursor:', response.plans.pageInfo.endCursor);
      }

    } catch (error) {
      console.error('\n❌ Error fetching plans:', error.message);
      console.error('   Full error:', error);
      
      if (error.message.includes('404')) {
        console.log('\n💡 This might mean the company ID is invalid');
      }
    }

    // Test 3: Try alternative API endpoints
    console.log('\n3️⃣ Testing other potentially useful endpoints:');
    
    try {
      // Try to get company info
      const companyInfo = await whopSdk.companies.getCompany({
        companyId: testCompanyId
      });
      
      console.log('✅ Company info fetched:');
      console.log('   - Name:', companyInfo?.title || 'N/A');
      console.log('   - ID:', companyInfo?.id || 'N/A');
    } catch (error) {
      console.log('❌ Could not fetch company info:', error.message);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }

  console.log('\n' + '=' . repeat(50));
  console.log('✅ Test complete!\n');
}

// Helper to replace string.repeat() which might not work in older Node
String.prototype.repeat = String.prototype.repeat || function(count) {
  return new Array(count + 1).join(this);
};

// Run the test
testWhopProducts().catch(console.error);