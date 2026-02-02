import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.WHOP_API_KEY;
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('API Key prefix:', apiKey ? apiKey.substring(0, 20) + '...' : 'MISSING');

// Test 1: Direct HTTP without filter
console.log('\n1. HTTP API without filter:');
try {
  const resp = await fetch('https://api.whop.com/api/v5/app/products?per=10', {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  const data = await resp.json();
  console.log('   Status:', resp.status);
  const products = data.data || [];
  console.log('   Products count:', products.length);
  const forCompany = products.filter(p => p.company_id === companyId);
  console.log('   For our company:', forCompany.length);
  forCompany.slice(0, 3).forEach(p => {
    console.log('   -', p.title, '| visibility:', p.visibility);
  });
} catch (e) {
  console.log('   Error:', e.message);
}

// Test 2: Direct HTTP with product_types filter
console.log('\n2. HTTP API WITH product_types=regular:');
try {
  const resp = await fetch('https://api.whop.com/api/v5/app/products?per=10&product_types[]=regular', {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  const data = await resp.json();
  console.log('   Status:', resp.status);
  const products = data.data || [];
  console.log('   Products count:', products.length);
  const forCompany = products.filter(p => p.company_id === companyId);
  console.log('   For our company:', forCompany.length);
  forCompany.slice(0, 3).forEach(p => {
    console.log('   -', p.title, '| visibility:', p.visibility);
  });
} catch (e) {
  console.log('   Error:', e.message);
}

// Test 3: SDK products.list with company_id
console.log('\n3. SDK products.list WITH company_id:');
try {
  const Whop = (await import('@whop/sdk')).default;
  const whop = new Whop({ apiKey: apiKey });
  
  let count = 0;
  for await (const product of whop.products.list({ company_id: companyId })) {
    count++;
    console.log('   -', product.title);
    if (count >= 3) break;
  }
  console.log('   Total found:', count);
} catch (e) {
  console.log('   Error:', e.status, e.message);
}

// Test 4: SDK without company_id filter
console.log('\n4. SDK products.list WITHOUT company_id:');
try {
  const Whop = (await import('@whop/sdk')).default;
  const whop = new Whop({ apiKey: apiKey });
  
  let count = 0;
  for await (const product of whop.products.list({})) {
    count++;
    console.log('   -', product.title, '| company:', product.company_id);
    if (count >= 3) break;
  }
  console.log('   Total found:', count);
} catch (e) {
  console.log('   Error:', e.status, e.message);
}

console.log('\nDone!');
