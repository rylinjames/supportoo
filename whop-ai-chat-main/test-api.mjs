#!/usr/bin/env node
import { WhopServerSdk } from '@whop/api';

const apiKey = 'apik_w9a0v4OB6VUfl_A2021772_C_f2b9c8d7d5c1902086d5da24c12541f8c45dc6382c7259a3e4d238c4cb2d89';
const appId = 'app_Z6bbsQEQUmRQQH';

console.log('\n🧪 Testing Whop Products API\n');
console.log('='.repeat(50));

const whopSdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

console.log('✅ SDK initialized');
console.log('  App ID:', appId);

// List available methods
console.log('\nAvailable company methods:');
const methods = Object.keys(whopSdk.companies || {});
methods.forEach(m => console.log('  -', m));

// Try to fetch plans for BookKoo Buxs or another known company
// Using the actual company ID from .env.local
const testCompanyIds = [
  'biz_2T7tC1fnFVo6d4', // Actual Whop company ID from env
  'comp_2T7tC1fnFVo6d4', // Alternative format
];

console.log('\n🔍 Testing multiple company IDs to find one with plans...\n');

let foundPlans = false;

for (const companyId of testCompanyIds) {
  console.log(`Testing company: ${companyId}`);
  
  try {
    // First try to get company info
    const companyInfo = await whopSdk.companies.getCompany({
      companyId: companyId
    });
    
    if (companyInfo) {
      console.log(`  ✅ Company found: ${companyInfo.title || companyInfo.id}`);
    }
    
    // Now try to get plans
    const response = await whopSdk.companies.listPlans({
      companyId: companyId,
      first: 10,
    });

    const planCount = response?.plans?.nodes?.filter(Boolean).length || 0;
    
    if (planCount > 0) {
      console.log(`  🎉 Found ${planCount} plans!`);
      foundPlans = true;
      
      console.log('\n📦 Plan Details:');
      response.plans.nodes.filter(Boolean).forEach((plan, i) => {
        console.log(`\n  Plan ${i + 1}:`);
        console.log('    ID:', plan.id);
        
        // Try to extract meaningful fields from the plan
        const fields = Object.keys(plan);
        console.log('    Available fields:', fields.slice(0, 15).join(', '));
        
        // Try common field names
        console.log('    Title:', plan.title || plan.name || 'N/A');
        console.log('    Price:', plan.price || plan.amount || 'N/A');
        console.log('    Type:', plan.type || plan.category || 'N/A');
        console.log('    Status:', plan.status || plan.is_active || 'N/A');
        
        // Show first few fields with values
        if (i === 0) {
          console.log('\n    Sample data structure:');
          Object.entries(plan).slice(0, 5).forEach(([key, value]) => {
            if (typeof value !== 'object') {
              console.log(`      ${key}:`, value);
            }
          });
        }
      });
      
      break; // Stop once we find a company with plans
    } else {
      console.log(`  ⚠️ No plans found`);
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  console.log('');
}

if (!foundPlans) {
  console.log('⚠️ No plans found in any tested company');
  console.log('\nThis could mean:');
  console.log('  1. The companies don\'t have any products set up');
  console.log('  2. The company IDs are incorrect');
  console.log('  3. The API requires different permissions');
  console.log('\n💡 Try adding your actual Whop company ID to the test');
}

console.log('\n' + '='.repeat(50));
console.log('Test complete!\n');