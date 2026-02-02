import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = new ConvexHttpClient(CONVEX_URL);

console.log('Looking for Ticketoo company in database...\n');

const companies = await client.query(api.companies.queries.getAllCompanies, {});

// Find companies with "ticket" in name
const ticketCompanies = companies.filter(c => 
  c.name?.toLowerCase().includes('ticket') || 
  c.whopCompanyId?.toLowerCase().includes('ticket')
);

if (ticketCompanies.length > 0) {
  console.log('Found Ticketoo-related companies:');
  ticketCompanies.forEach(c => {
    console.log(`  - ${c.name}`);
    console.log(`    Convex ID: ${c._id}`);
    console.log(`    Whop ID: ${c.whopCompanyId}`);
    console.log('');
  });
} else {
  console.log('No company with "ticket" in name found.');
  console.log('\nAll companies:');
  companies.slice(0, 10).forEach(c => {
    console.log(`  - ${c.name} | ${c.whopCompanyId}`);
  });
}

console.log('\nDone!');
