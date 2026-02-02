import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Whop from '@whop/sdk';

const apiKey = process.env.WHOP_API_KEY;
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('Testing different SDK configurations...\n');

// Test 1: With appId (how we currently have it)
console.log('1. SDK with apiKey only:');
try {
  const sdk1 = new Whop({ apiKey });
  let count = 0;
  for await (const p of sdk1.products.list({ company_id: companyId, product_types: ['regular'] })) {
    count++;
    if (count >= 3) break;
  }
  console.log('   Found:', count, 'products');
} catch (e) {
  console.log('   Error:', e.status, '-', e.message?.substring(0, 80));
}

// Test 2: Without company_id filter (maybe it requires withCompany?)
console.log('\n2. SDK without company_id, just product_types:');
try {
  const sdk2 = new Whop({ apiKey });
  let count = 0;
  for await (const p of sdk2.products.list({ product_types: ['regular'] })) {
    console.log('   -', p.title, '| company:', p.company_id);
    count++;
    if (count >= 5) break;
  }
  console.log('   Found:', count, 'products');
} catch (e) {
  console.log('   Error:', e.status, '-', e.message?.substring(0, 80));
}

// Test 3: Check if there's a companyId method
console.log('\n3. Check SDK methods:');
const sdk3 = new Whop({ apiKey });
console.log('   Has withCompany?', typeof sdk3.withCompany);
console.log('   Has asCompany?', typeof sdk3.asCompany);

console.log('\nDone!');
