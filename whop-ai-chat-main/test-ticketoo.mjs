import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.WHOP_API_KEY;

// Find Ticketoo's company ID - need to check all products
console.log('Checking all companies and their products...\n');

const resp = await fetch('https://api.whop.com/api/v5/app/products?per=100', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
const data = await resp.json();
const products = data.data || [];

// Group by company
const byCompany = {};
products.forEach(p => {
  const cid = p.company_id;
  if (!byCompany[cid]) byCompany[cid] = [];
  byCompany[cid].push(p);
});

console.log('Companies with products:');
for (const [cid, prods] of Object.entries(byCompany)) {
  console.log(`\n${cid}: ${prods.length} products`);
  
  // Show product types breakdown
  const types = {};
  prods.forEach(p => {
    const type = p.product_type || 'unknown';
    types[type] = (types[type] || 0) + 1;
  });
  console.log('  Product types:', JSON.stringify(types));
  
  // Show visibility breakdown  
  const vis = {};
  prods.forEach(p => {
    vis[p.visibility] = (vis[p.visibility] || 0) + 1;
  });
  console.log('  Visibility:', JSON.stringify(vis));
  
  // Show first 3 products
  prods.slice(0, 3).forEach(p => {
    console.log(`    - ${p.title} | type: ${p.product_type || 'N/A'} | vis: ${p.visibility}`);
  });
}

// Now test with filter
console.log('\n\n--- WITH product_types[]=regular filter ---');
const resp2 = await fetch('https://api.whop.com/api/v5/app/products?per=100&product_types[]=regular', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
const data2 = await resp2.json();
const products2 = data2.data || [];

console.log('Total products with filter:', products2.length);

const byCompany2 = {};
products2.forEach(p => {
  const cid = p.company_id;
  if (!byCompany2[cid]) byCompany2[cid] = [];
  byCompany2[cid].push(p);
});

for (const [cid, prods] of Object.entries(byCompany2)) {
  console.log(`  ${cid}: ${prods.length} products`);
}

console.log('\nDone!');
