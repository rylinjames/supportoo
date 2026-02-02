import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// Find BooKoo Apps
const companies = await client.query(api.companies.queries.getAllCompanies, {});
const bookoo = companies.find(c => c.name === 'BooKoo Apps');

if (bookoo) {
  console.log('Testing sync for BooKoo Apps...');
  console.log('Company ID:', bookoo._id);
  console.log('Whop ID:', bookoo.whopCompanyId);
  
  const result = await client.action(api.products.actions.syncProducts, {
    companyId: bookoo._id,
  });
  
  console.log('\nResult:', JSON.stringify(result, null, 2));
} else {
  console.log('BooKoo Apps not found');
}
