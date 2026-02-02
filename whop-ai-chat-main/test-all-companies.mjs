import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.WHOP_API_KEY;

console.log('Checking ALL products across all companies...\n');

// Fetch ALL products
const resp = await fetch('https://api.whop.com/api/v5/app/products?per=100', {
  headers: { 'Authorization': 'Bearer ' + apiKey }
});
const data = await resp.json();
const all = data.data || [];

console.log('Total products:', all.length);

// Group by company
const byCompany = {};
all.forEach(p => {
  const cid = p.company_id || 'unknown';
  if (!byCompany[cid]) byCompany[cid] = [];
  byCompany[cid].push(p);
});

console.log('\nProducts by company:');
Object.entries(byCompany).forEach(([cid, products]) => {
  console.log(`\n  ${cid}: ${products.length} products`);
  
  // Show visibility breakdown
  const byVis = {};
  products.forEach(p => {
    byVis[p.visibility] = (byVis[p.visibility] || 0) + 1;
  });
  console.log('    Visibility:', JSON.stringify(byVis));
  
  // Check for quick_link (checkout links)
  const checkoutLinks = products.filter(p => p.visibility === 'quick_link');
  if (checkoutLinks.length > 0) {
    console.log('    ⚠️ CHECKOUT LINKS FOUND:', checkoutLinks.length);
    checkoutLinks.slice(0, 3).forEach(p => {
      console.log('      -', p.title);
    });
  }
});

console.log('\nDone!');
