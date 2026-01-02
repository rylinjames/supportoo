#!/usr/bin/env node
import { WhopServerSdk } from '@whop/api';

const apiKey = 'apik_w9a0v4OB6VUfl_A2021772_C_f2b9c8d7d5c1902086d5da24c12541f8c45dc6382c7259a3e4d238c4cb2d89';
const appId = 'app_Z6bbsQEQUmRQQH';
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('\n🔨 CREATING ACCESS PASS WITH CORRECT FIELDS\n');
console.log('='.repeat(60));

const whopSdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

// Based on the error, we need: title (required), and possibly other fields
// Let's try with minimal required fields

console.log('1️⃣ Attempting to create AccessPass with title field...');
try {
  const accessPass = await whopSdk.accessPasses.createAccessPass({
    companyId: companyId,
    title: 'Test API Product Hidden',
    // Try other possible field names based on common patterns
    description: 'Test product created via API',
    visibility: 'private',
  });
  
  console.log('✅ Success! Created access pass:');
  console.log(JSON.stringify(accessPass, null, 2));
  
  // Now check if it appears in the list
  console.log('\n2️⃣ Checking if it appears in listAccessPasses...');
  const passes = await whopSdk.companies.listAccessPasses({ companyId, first: 10 });
  console.log('Access passes response:', JSON.stringify(passes, null, 2));
  
} catch (error) {
  console.log('❌ Failed:', error.message);
  
  // Parse the error to understand required fields
  if (error.message.includes('Expected value to not be null')) {
    console.log('\nRequired fields from error:');
    const matches = error.message.match(/(\w+) \(Expected value to not be null\)/g);
    if (matches) {
      matches.forEach(match => {
        const field = match.match(/(\w+) \(/)?.[1];
        if (field) console.log('  -', field);
      });
    }
  }
  
  // Try to understand the correct input structure
  if (error.message.includes('CreateAccessPassInput')) {
    console.log('\nTrying alternative field combinations...');
    
    // Try 2: Different field structure
    try {
      const accessPass2 = await whopSdk.accessPasses.createAccessPass({
        companyId: companyId,
        input: {
          title: 'Test API Product',
          companyId: companyId,
        }
      });
      console.log('✅ Alternative structure worked!');
      console.log(JSON.stringify(accessPass2, null, 2));
    } catch (error2) {
      console.log('❌ Alternative also failed:', error2.message.substring(0, 200));
    }
  }
}

// Let's also check the promo code structure more carefully
console.log('\n3️⃣ Creating PromoCode with correct fields...');
try {
  const promo = await whopSdk.promoCodes.createPromoCode({
    companyId: companyId,
    code: 'APITEST' + Math.floor(Math.random() * 10000),
    amountOff: 500, // $5 off in cents
    baseCurrency: 'usd', // lowercase as required
    newUsersOnly: false,
    promoType: 'amount_off', // or 'percentage_off'
    // Try additional fields
    maxUses: 1,
    expiresAt: new Date(Date.now() + 86400000).toISOString(), // Expires in 24 hours
  });
  
  console.log('✅ Created promo code:');
  console.log(JSON.stringify(promo, null, 2));
  
  // Check if promo codes reference products
  const promos = await whopSdk.promoCodes.listPromoCodes({ companyId, first: 5 });
  console.log('\nPromo codes list:', JSON.stringify(promos, null, 2));
  
} catch (error) {
  console.log('❌ Promo creation failed:', error.message.substring(0, 300));
}

// Try creating a checkout session with correct fields
console.log('\n4️⃣ Creating Checkout Session with correct currency format...');
try {
  const checkout = await whopSdk.payments.createCheckoutSession({
    companyId: companyId,
    currency: 'usd', // lowercase as required
    // We need to find what other fields are required
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
  });
  
  console.log('✅ Created checkout session:');
  console.log(JSON.stringify(checkout, null, 2));
  
} catch (error) {
  console.log('❌ Checkout creation failed:', error.message.substring(0, 300));
  
  // Extract required fields
  if (error.message.includes('Expected value to not be null')) {
    const requiredFields = error.message.match(/(\w+) \(Expected value to not be null\)/g);
    if (requiredFields) {
      console.log('\nRequired fields for checkout:');
      requiredFields.forEach(field => {
        const name = field.match(/(\w+) \(/)?.[1];
        if (name) console.log('  -', name);
      });
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('🏁 CONCLUSION');
console.log('='.repeat(60));
console.log('The Whop API does not support creating products/plans.');
console.log('Access passes and checkout sessions are for processing');
console.log('payments for existing products, not creating new ones.');
console.log('\nProducts must be created in the Whop dashboard.\n');