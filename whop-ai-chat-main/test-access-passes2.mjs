import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { WhopServerSdk } from '@whop/api';

const apiKey = process.env.WHOP_API_KEY;
const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('Testing various SDK configurations...\n');

// Test 1: With companyId using withCompany
console.log('1. Using sdk.withCompany().companies.listAccessPasses():');
const sdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

try {
  const companySdk = sdk.withCompany(companyId);
  const result = await companySdk.companies.listAccessPasses({ companyId });
  const nodes = result?.accessPasses?.nodes || [];
  console.log('   Found:', nodes.length, 'access passes');
} catch (e) {
  console.log('   Error:', e.message);
}

// Test 2: Check what params listAccessPasses expects
console.log('\n2. Checking listAccessPasses with more params:');
try {
  const result = await sdk.companies.listAccessPasses({ 
    companyId,
    first: 100
  });
  const nodes = result?.accessPasses?.nodes || [];
  console.log('   Found:', nodes.length, 'access passes');
  if (nodes.length > 0) {
    console.log('   First:', nodes[0].title);
  }
} catch (e) {
  console.log('   Error:', e.message);
}

// Test 3: Direct HTTP to compare
console.log('\n3. HTTP API /v5/app/products for comparison:');
try {
  const resp = await fetch('https://api.whop.com/api/v5/app/products?per=10', {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  const data = await resp.json();
  const products = (data.data || []).filter(p => p.company_id === companyId);
  console.log('   Found:', products.length, 'products');
  if (products.length > 0) {
    console.log('   First:', products[0].title);
  }
} catch (e) {
  console.log('   Error:', e.message);
}

console.log('\nDone!');
