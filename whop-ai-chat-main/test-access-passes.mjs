import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { WhopServerSdk } from '@whop/api';

const apiKey = process.env.WHOP_API_KEY;
const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('Testing sdk.companies.listAccessPasses()...\n');

const sdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

try {
  const result = await sdk.companies.listAccessPasses({ companyId });
  console.log('Success!');
  console.log('Result structure:', Object.keys(result || {}));
  
  const nodes = result?.accessPasses?.nodes || [];
  console.log('\nFound', nodes.length, 'access passes (products):');
  
  nodes.slice(0, 10).forEach((p, i) => {
    console.log(`${i+1}. ${p.title}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Visibility: ${p.visibility}`);
    console.log(`   Route: ${p.route}`);
    console.log('');
  });
  
  // Check for checkout links
  const checkoutLinks = nodes.filter(p => p.visibility === 'quick_link');
  console.log('\nCheckout links (quick_link):', checkoutLinks.length);
  
  // Show visibility breakdown
  const byVis = {};
  nodes.forEach(p => {
    byVis[p.visibility] = (byVis[p.visibility] || 0) + 1;
  });
  console.log('Visibility breakdown:', byVis);
  
} catch (e) {
  console.log('Error:', e.message);
  console.log(e);
}

console.log('\nDone!');
