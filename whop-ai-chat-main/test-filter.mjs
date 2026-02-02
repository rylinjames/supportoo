import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.WHOP_API_KEY;
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('Testing product_types filter effectiveness...\n');

// Fetch ALL products (no filter)
const resp1 = await fetch('https://api.whop.com/api/v5/app/products?per=100', {
  headers: { 'Authorization': 'Bearer ' + apiKey }
});
const data1 = await resp1.json();
const all = (data1.data || []).filter(p => p.company_id === companyId);

// Fetch only regular products
const resp2 = await fetch('https://api.whop.com/api/v5/app/products?per=100&product_types[]=regular', {
  headers: { 'Authorization': 'Bearer ' + apiKey }
});
const data2 = await resp2.json();
const regular = (data2.data || []).filter(p => p.company_id === companyId);

console.log('WITHOUT filter:', all.length, 'products');
console.log('WITH product_types=regular:', regular.length, 'products');
console.log('Difference:', all.length - regular.length, 'filtered out\n');

// Show what got filtered
const regularIds = new Set(regular.map(p => p.id));
const filtered = all.filter(p => !regularIds.has(p.id));

if (filtered.length > 0) {
  console.log('FILTERED OUT (checkout links):');
  filtered.forEach(p => {
    console.log('  -', p.title || p.name, '| visibility:', p.visibility);
  });
} else {
  console.log('No difference - all products are "regular" type');
  console.log('\nAll products visibility breakdown:');
  const byVisibility = {};
  all.forEach(p => {
    byVisibility[p.visibility] = (byVisibility[p.visibility] || 0) + 1;
  });
  console.log(byVisibility);
}

console.log('\nDone!');
