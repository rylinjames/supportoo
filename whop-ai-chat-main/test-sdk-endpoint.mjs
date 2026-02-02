import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.WHOP_API_KEY;
const companyId = 'biz_2T7tC1fnFVo6d4';

// Check what URL the SDK is actually calling
console.log('Testing SDK endpoint discovery...\n');

const Whop = (await import('@whop/sdk')).default;

// Create SDK with debug logging
const whop = new Whop({ 
  apiKey: apiKey,
  // Try to see base URL
});

console.log('SDK instance created');
console.log('SDK baseURL:', whop.baseURL);

// Check the products resource
console.log('\nProducts resource:', whop.products);
console.log('Products resource methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(whop.products)));

// Try to see the actual request being made
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  console.log('\n📡 SDK is calling:', url);
  console.log('   Method:', options?.method || 'GET');
  console.log('   Headers:', JSON.stringify(options?.headers, null, 2));
  return originalFetch(url, options);
};

try {
  for await (const product of whop.products.list({ company_id: companyId })) {
    console.log('Product:', product.title);
    break;
  }
} catch (e) {
  console.log('\nError:', e.message);
}

console.log('\nDone!');
