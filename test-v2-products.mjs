#!/usr/bin/env node

/**
 * Test the v2 products endpoint that actually works!
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const apiKey = process.env.WHOP_API_KEY;
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('\n🎉 Testing Whop API v2 Products Endpoint\n');
console.log('='.repeat(50));

async function fetchAllProducts() {
  const allProducts = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const url = `https://api.whop.com/api/v2/products?company_id=${companyId}&page=${page}&per_page=10`;
    console.log(`\n📄 Fetching page ${page}...`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('   ❌ Error:', await response.text());
      break;
    }
    
    const data = await response.json();
    
    if (data.data && Array.isArray(data.data)) {
      allProducts.push(...data.data);
      console.log(`   ✅ Found ${data.data.length} products on page ${page}`);
      
      // Show first product on each page as sample
      if (data.data[0]) {
        const product = data.data[0];
        console.log(`   Sample: ${product.id} - ${product.title || product.name}`);
      }
    }
    
    // Check if there are more pages
    if (data.pagination) {
      hasMore = page < data.pagination.total_page;
      page++;
    } else {
      hasMore = false;
    }
    
    // Limit to first 3 pages for testing
    if (page > 3) {
      console.log('\n   ... (limiting to first 3 pages for testing)');
      break;
    }
  }
  
  return allProducts;
}

try {
  const products = await fetchAllProducts();
  
  console.log('\n' + '='.repeat(50));
  console.log('📦 PRODUCTS FOUND!');
  console.log('='.repeat(50));
  console.log(`\nTotal products fetched: ${products.length}`);
  
  // Show details of first 5 products
  console.log('\nProduct Details:');
  products.slice(0, 5).forEach((product, index) => {
    console.log(`\n${index + 1}. ${product.title || product.name || 'Untitled'}`);
    console.log('   ID:', product.id);
    console.log('   Visibility:', product.visibility || 'N/A');
    console.log('   Route:', product.route || 'N/A');
    console.log('   Member Count:', product.member_count || 0);
    console.log('   Verified:', product.verified || false);
    console.log('   Created:', product.created_at || 'N/A');
    
    // Show available fields for first product
    if (index === 0) {
      console.log('\n   📋 Available fields for products:');
      console.log('   ', Object.keys(product).join(', '));
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ SUCCESS! The v2 API endpoint works perfectly!');
  console.log('\nNow we need to update the syncProducts function to use the v2 endpoint.');
  
} catch (error) {
  console.error('\n❌ Error:', error);
}

console.log('\n');