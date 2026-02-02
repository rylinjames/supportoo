import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Whop from '@whop/sdk';

// Check if there's a test token in env
const testToken = process.env.WHOP_USER_TOKEN || process.env.TEST_USER_TOKEN;

if (testToken) {
  console.log('Found test token, testing SDK...');
  
  const sdk = new Whop({ apiKey: testToken });
  const companyId = 'biz_2T7tC1fnFVo6d4'; // BooKoo Apps
  
  try {
    let count = 0;
    console.log('Fetching products with product_types: ["regular"]...\n');
    
    for await (const product of sdk.products.list({
      company_id: companyId,
      product_types: ['regular']
    })) {
      console.log(`${++count}. ${product.title} | visibility: ${product.visibility}`);
      if (count >= 10) {
        console.log('... (limited to 10)');
        break;
      }
    }
    
    console.log('\n✅ SDK with userToken WORKS!');
    console.log(`Found ${count} products (checkout links filtered out)`);
  } catch (e) {
    console.log('❌ SDK Error:', e.status, e.message);
  }
} else {
  console.log('No test token found in environment.');
  console.log('');
  console.log('To test, you need a userToken from Whop OAuth.');
  console.log('The app gets this automatically when a user opens it.');
  console.log('');
  console.log('Options to test:');
  console.log('1. Open the app in Whop and check Convex logs');
  console.log('2. Add a test token to .env.local as WHOP_USER_TOKEN');
}

console.log('\nDone!');
