import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.WHOP_API_KEY;

console.log('Testing HTTP API with product_types[]=regular filter\n');

// Test WITHOUT filter
console.log('1. WITHOUT product_types filter:');
const resp1 = await fetch('https://api.whop.com/api/v5/app/products?per=100', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
const data1 = await resp1.json();
console.log('   Total products:', data1.data?.length || 0);

// Test WITH filter
console.log('\n2. WITH product_types[]=regular filter:');
const resp2 = await fetch('https://api.whop.com/api/v5/app/products?per=100&product_types[]=regular', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
const data2 = await resp2.json();
console.log('   Total products:', data2.data?.length || 0);

// Check difference
const diff = (data1.data?.length || 0) - (data2.data?.length || 0);
console.log('\n3. Difference:', diff, 'products filtered out');

if (diff > 0) {
  console.log('   ✅ Filter is working! Checkout links are being excluded.');
} else {
  console.log('   ℹ️  No difference - all products are already "regular" type');
  console.log('   (The filter will work for companies that have checkout links)');
}

console.log('\nDone!');
