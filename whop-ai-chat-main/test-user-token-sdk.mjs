import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Whop from '@whop/sdk';

const appApiKey = process.env.WHOP_API_KEY;
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('To test: Initialize SDK with userToken instead of App API key\n');

// The userToken would come from Whop OAuth when user logs in
// Format: A JWT token that starts differently than apik_

// For now, let's verify what type of token the SDK expects
console.log('Current API key type: App API Key (apik_...)');
console.log('SDK base URL: /api/v1');
console.log('');
console.log('THEORY: Taylor is using the userToken (from OAuth) as the apiKey');
console.log('The userToken gives permissions that the App API key does not have');
console.log('');
console.log('SOLUTION: In syncProducts, when userToken is provided:');
console.log('  const sdk = new Whop({ apiKey: userToken });  // Use userToken!');
console.log('  sdk.products.list({ company_id, product_types: ["regular"] })');

console.log('\nDone!');
