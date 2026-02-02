import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { WhopServerSdk } from '@whop/api';

const apiKey = process.env.WHOP_API_KEY;
const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('Testing @whop/api (GraphQL SDK)...\n');
console.log('App ID:', appId);

const sdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

// Check available methods
console.log('\nSDK methods:', Object.keys(sdk));

// Try to find products method
if (sdk.products) {
  console.log('\nProducts methods:', Object.keys(sdk.products));
}

// Check if there's a way to list products with this SDK
console.log('\n--- Testing various approaches ---\n');

// Try listAccessPasses (these are the "products" in Whop)
try {
  console.log('1. Trying listAccessPasses...');
  const result = await sdk.listAccessPasses({ companyId });
  console.log('   Success! Found:', result?.accessPasses?.nodes?.length || 0, 'access passes');
  if (result?.accessPasses?.nodes?.length > 0) {
    result.accessPasses.nodes.slice(0, 3).forEach(p => {
      console.log('   -', p.title);
    });
  }
} catch (e) {
  console.log('   Error:', e.message);
}

// Try getCompany to see products
try {
  console.log('\n2. Trying getCompany...');
  const result = await sdk.getCompany({ companyId });
  console.log('   Company:', result?.company?.title);
} catch (e) {
  console.log('   Error:', e.message);
}

console.log('\nDone!');
