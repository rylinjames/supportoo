import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { WhopServerSdk } from '@whop/api';

const apiKey = process.env.WHOP_API_KEY;
const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('Testing @whop/api namespaced methods...\n');

const sdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

// Check accessPasses namespace
console.log('accessPasses methods:', Object.keys(sdk.accessPasses));
console.log('companies methods:', Object.keys(sdk.companies));

// Try accessPasses.list
try {
  console.log('\n1. Trying sdk.accessPasses.list()...');
  const result = await sdk.accessPasses.list({ companyId });
  console.log('   Result keys:', Object.keys(result || {}));
  if (result?.accessPasses?.nodes) {
    console.log('   Found:', result.accessPasses.nodes.length, 'access passes');
    result.accessPasses.nodes.slice(0, 3).forEach(p => {
      console.log('   -', p.title, '| id:', p.id);
    });
  }
} catch (e) {
  console.log('   Error:', e.message);
}

// Try companies.get
try {
  console.log('\n2. Trying sdk.companies.get()...');
  const result = await sdk.companies.get({ companyId });
  console.log('   Company:', result?.company?.title);
} catch (e) {
  console.log('   Error:', e.message);
}

// Check if there's a products namespace or similar
console.log('\n\nAll SDK namespaces and their methods:');
for (const [name, obj] of Object.entries(sdk)) {
  if (typeof obj === 'object' && obj !== null) {
    const methods = Object.keys(obj);
    if (methods.length > 0) {
      console.log(`  ${name}:`, methods.join(', '));
    }
  }
}

console.log('\nDone!');
