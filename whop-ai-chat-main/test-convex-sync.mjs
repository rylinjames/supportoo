import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
console.log('Convex URL:', CONVEX_URL);

if (!CONVEX_URL) {
  console.error('Missing NEXT_PUBLIC_CONVEX_URL');
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

console.log('\nFetching companies...');

try {
  const companies = await client.query(api.companies.queries.getAllCompanies, {});
  console.log('Found', companies.length, 'companies:');
  companies.forEach(c => {
    console.log(`  - ${c.name} (${c._id}) | whopId: ${c.whopCompanyId}`);
  });

  if (companies.length > 0) {
    const testCompany = companies[0];
    console.log('\nTesting syncProducts for:', testCompany.name);
    console.log('Note: No userToken - will use HTTP fallback');

    const result = await client.action(api.products.actions.syncProducts, {
      companyId: testCompany._id,
    });

    console.log('\nSync result:', JSON.stringify(result, null, 2));
  }
} catch (e) {
  console.error('Error:', e.message);
}

console.log('\nDone!');
