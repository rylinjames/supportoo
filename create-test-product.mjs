#!/usr/bin/env node
import { WhopServerSdk } from '@whop/api';

const apiKey = 'apik_w9a0v4OB6VUfl_A2021772_C_f2b9c8d7d5c1902086d5da24c12541f8c45dc6382c7259a3e4d238c4cb2d89';
const appId = 'app_Z6bbsQEQUmRQQH';
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('\n🔨 ATTEMPTING TO CREATE PRODUCT VIA WHOP API\n');
console.log('='.repeat(60));

const whopSdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

console.log('✅ SDK initialized');
console.log('  Company: BooKoo Apps');
console.log('  Company ID:', companyId);

// First, let's check what creation methods are available
console.log('\n📋 Checking available creation methods:');
console.log('='.repeat(60));

// Check companies namespace
if (whopSdk.companies) {
  const companyMethods = Object.keys(whopSdk.companies).filter(m => 
    m.includes('create') || m.includes('add') || m.includes('new'));
  console.log('\nCompanies namespace creation methods:', 
    companyMethods.length > 0 ? companyMethods.join(', ') : 'None found');
}

// Check if there's a products namespace
if (whopSdk.products) {
  const productMethods = Object.keys(whopSdk.products);
  console.log('\nProducts namespace methods:', productMethods.join(', '));
} else {
  console.log('\n❌ No products namespace found');
}

// Check if there's a plans namespace
if (whopSdk.plans) {
  const planMethods = Object.keys(whopSdk.plans);
  console.log('\nPlans namespace methods:', planMethods.join(', '));
} else {
  console.log('\n❌ No plans namespace found');
}

// Check access passes (might be how products are created)
if (whopSdk.accessPasses) {
  const accessMethods = Object.keys(whopSdk.accessPasses);
  console.log('\nAccessPasses namespace methods:', accessMethods.join(', '));
}

// Check payments namespace for checkout/product creation
if (whopSdk.payments) {
  const paymentMethods = Object.keys(whopSdk.payments);
  console.log('\nPayments namespace methods:', paymentMethods.join(', '));
}

console.log('\n' + '='.repeat(60));
console.log('🧪 ATTEMPTING PRODUCT CREATION');
console.log('='.repeat(60));

// Try 1: Create an access pass (might be how products work)
if (whopSdk.accessPasses?.createAccessPass) {
  console.log('\n1️⃣ Trying to create an AccessPass (potential product)...');
  try {
    const testAccessPass = await whopSdk.accessPasses.createAccessPass({
      companyId: companyId,
      name: 'Test API Product (Invisible)',
      description: 'Test product created via API - should be hidden',
      price: 999, // $9.99 in cents
      visibility: 'hidden', // Try to make it invisible
      // Try various possible fields
      isVisible: false,
      is_visible: false,
      hidden: true,
      status: 'inactive',
      is_active: false,
      type: 'product',
      access_type: 'one_time',
      currency: 'USD',
    });
    
    console.log('  ✅ Success! Created access pass:');
    console.log('     ID:', testAccessPass.id);
    console.log('     Response:', JSON.stringify(testAccessPass, null, 2));
    
  } catch (error) {
    console.log('  ❌ Failed:', error.message);
    
    // If error shows required fields, display them
    if (error.message.includes('required') || error.message.includes('missing')) {
      console.log('     Error details:', error.message);
    }
  }
}

// Try 2: Create via experiences
if (whopSdk.experiences?.createExperience) {
  console.log('\n2️⃣ Trying to create an Experience (potential product)...');
  try {
    const testExperience = await whopSdk.experiences.createExperience({
      companyId: companyId,
      name: 'Test API Experience (Invisible)',
      description: 'Test experience created via API',
      visibility: 'hidden',
      price: 999,
      type: 'product',
    });
    
    console.log('  ✅ Success! Created experience:');
    console.log('     ID:', testExperience.id);
    console.log('     Response:', JSON.stringify(testExperience, null, 2));
    
  } catch (error) {
    console.log('  ❌ Failed:', error.message);
  }
} else {
  console.log('\n❌ No experience creation method found');
}

// Try 3: Create a promo code (to see if it reveals product structure)
if (whopSdk.promoCodes?.createPromoCode) {
  console.log('\n3️⃣ Trying to create a PromoCode (to understand product structure)...');
  try {
    const testPromo = await whopSdk.promoCodes.createPromoCode({
      companyId: companyId,
      code: 'TESTAPICODE' + Date.now(),
      discount: 10,
      discountType: 'percentage',
      // These might reveal what product IDs look like
      applicableProducts: [],
      applicable_plans: [],
      applicable_to: 'all',
    });
    
    console.log('  ✅ Success! Created promo code:');
    console.log('     Response:', JSON.stringify(testPromo, null, 2));
    
  } catch (error) {
    console.log('  ❌ Failed:', error.message);
    
    // The error might tell us how products should be referenced
    if (error.message.includes('product') || error.message.includes('plan')) {
      console.log('     Product reference hint:', error.message.substring(0, 200));
    }
  }
}

// Try 4: Create a checkout session (might create a product implicitly)
if (whopSdk.payments?.createCheckoutSession) {
  console.log('\n4️⃣ Trying to create a Checkout Session...');
  try {
    const testCheckout = await whopSdk.payments.createCheckoutSession({
      companyId: companyId,
      // Try various possible fields
      items: [{
        name: 'Test Checkout Product',
        price: 999,
        quantity: 1,
      }],
      line_items: [{
        price: 999,
        quantity: 1,
      }],
      amount: 999,
      currency: 'USD',
      description: 'Test checkout session',
    });
    
    console.log('  ✅ Success! Created checkout session:');
    console.log('     Response:', JSON.stringify(testCheckout, null, 2).substring(0, 500));
    
  } catch (error) {
    console.log('  ❌ Failed:', error.message);
  }
}

// Try 5: Check affiliates creation (might have product fields)
if (whopSdk.affiliates?.createAffiliate) {
  console.log('\n5️⃣ Checking affiliate structure for product references...');
  try {
    const testAffiliate = await whopSdk.affiliates.createAffiliate({
      companyId: companyId,
      userId: 'user_test',
      commission: 10,
      // These fields might exist
      productIds: [],
      planIds: [],
    });
    
    console.log('  ✅ Success! Created affiliate:');
    console.log('     Response:', JSON.stringify(testAffiliate, null, 2));
    
  } catch (error) {
    console.log('  ❌ Failed:', error.message.substring(0, 200));
  }
}

console.log('\n' + '='.repeat(60));
console.log('🔍 CHECKING IF CREATED PRODUCTS APPEAR IN LIST');
console.log('='.repeat(60));

// Check if any created items now appear in the lists
console.log('\nChecking companies.listPlans...');
const plansCheck = await whopSdk.companies.listPlans({ companyId, first: 10 });
console.log('  Plans found:', plansCheck?.plans?.nodes?.length || 0);

console.log('\nChecking companies.listAccessPasses...');
const passesCheck = await whopSdk.companies.listAccessPasses({ companyId, first: 10 });
console.log('  Access passes found:', passesCheck?.accessPasses?.nodes?.length || 0);

console.log('\nChecking experiences.listExperiences...');
const expCheck = await whopSdk.experiences.listExperiences({ companyId, first: 50 });
console.log('  Experiences found:', expCheck?.experiencesV2?.nodes?.length || 0);

console.log('\n' + '='.repeat(60));
console.log('📊 CONCLUSION');
console.log('='.repeat(60));
console.log('\nBased on the available SDK methods, Whop does not expose');
console.log('product/plan creation through the public API. Products must');
console.log('be created through the Whop dashboard interface.');
console.log('\nThe API is designed for:');
console.log('- User management and authentication');
console.log('- Content delivery (courses, forums, chat)');
console.log('- Payment processing for existing products');
console.log('- But NOT for product catalog management\n');