#!/usr/bin/env node

/**
 * Test script to verify the new @whop/sdk can fetch products
 * Run with: node test-new-sdk-products.mjs
 */

import Whop from '@whop/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const apiKey = process.env.WHOP_API_KEY;
const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
const companyId = 'biz_2T7tC1fnFVo6d4'; // BooKoo Apps

console.log('\n🧪 Testing NEW Whop SDK (@whop/sdk) Products API\n');
console.log('='.repeat(50));

if (!apiKey || !appId) {
  console.error('❌ Missing environment variables');
  console.error('   WHOP_API_KEY:', apiKey ? '✅' : '❌');
  console.error('   NEXT_PUBLIC_WHOP_APP_ID:', appId ? '✅' : '❌');
  process.exit(1);
}

console.log('✅ Environment loaded');
console.log('   API Key:', apiKey.substring(0, 20) + '...');
console.log('   App ID:', appId);
console.log('   Company ID:', companyId);

try {
  // Initialize the new SDK with app context
  // The new SDK might need different configuration
  const whop = new Whop({
    apiKey: apiKey,
    appID: appId, // Add app ID for context
  });

  console.log('\n📋 Testing products.list() method...');
  console.log('-'.repeat(50));

  // Fetch products
  const products = [];
  let count = 0;
  
  console.log('\n🔍 Fetching products for company:', companyId);
  
  try {
    // Use the async iterator to fetch products
    for await (const product of whop.products.list({ 
      company_id: companyId 
    })) {
      count++;
      products.push(product);
      
      console.log(`\n📦 Product ${count}:`);
      console.log('   ID:', product.id);
      console.log('   Title:', product.title || 'N/A');
      console.log('   Visibility:', product.visibility || 'N/A');
      console.log('   Price:', product.price || 'N/A');
      console.log('   Route:', product.route || 'N/A');
      console.log('   Member Count:', product.member_count || 0);
      console.log('   Created:', product.created_at);
      
      // Show all available fields for the first product
      if (count === 1) {
        console.log('\n   🔑 Available fields:');
        console.log('   ', Object.keys(product).join(', '));
      }
      
      // Limit to 10 products for testing
      if (count >= 10) {
        console.log('\n   ... (limiting to first 10 products)');
        break;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ SUCCESS! Found ${count} products total`);
    
    if (count === 0) {
      console.log('\n⚠️  No products found. This could mean:');
      console.log('   1. The company has no products set up in Whop');
      console.log('   2. The company_id is incorrect');
      console.log('   3. There is a permissions issue with your API key');
    } else {
      console.log('\n📊 Summary:');
      console.log(`   Total products found: ${count}`);
      console.log('   Product IDs:', products.map(p => p.id).join(', '));
    }
    
  } catch (error) {
    console.error('\n❌ Error fetching products:', error.message);
    console.error('\nFull error:', error);
    
    if (error.message.includes('401')) {
      console.log('\n💡 This appears to be an authentication issue.');
      console.log('   Check that your API key is valid and has the right permissions.');
    } else if (error.message.includes('404')) {
      console.log('\n💡 The company ID may be invalid or not found.');
    }
  }

} catch (error) {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
}

console.log('\n' + '='.repeat(50));
console.log('✅ Test complete!\n');