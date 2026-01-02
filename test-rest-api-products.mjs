#!/usr/bin/env node

/**
 * Test script to fetch products using direct REST API
 * Based on the documentation showing GET /products endpoint
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const apiKey = process.env.WHOP_API_KEY;
const companyId = 'biz_2T7tC1fnFVo6d4'; // BooKoo Apps

console.log('\n🧪 Testing Whop REST API for Products\n');
console.log('='.repeat(50));

if (!apiKey) {
  console.error('❌ Missing WHOP_API_KEY');
  process.exit(1);
}

console.log('✅ Environment loaded');
console.log('   API Key:', apiKey.substring(0, 20) + '...');
console.log('   Company ID:', companyId);

async function testRestAPI() {
  try {
    // Test 1: Try the /products endpoint with Bearer auth
    console.log('\n1️⃣ Testing GET /products endpoint with Bearer auth...');
    
    const url = `https://api.whop.com/api/v1/products?company_id=${companyId}`;
    console.log('   URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('   Status:', response.status, response.statusText);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Success!');
      
      // Check for products in response
      const products = data.data || data.products || data;
      
      if (Array.isArray(products)) {
        console.log(`   Found ${products.length} products`);
        
        products.forEach((product, index) => {
          console.log(`\n   Product ${index + 1}:`);
          console.log('     ID:', product.id);
          console.log('     Title:', product.title);
          console.log('     Visibility:', product.visibility);
          console.log('     Route:', product.route);
          console.log('     Member Count:', product.member_count);
        });
      } else if (data.data && Array.isArray(data.data)) {
        console.log(`   Found ${data.data.length} products in data field`);
        data.data.forEach((product, index) => {
          console.log(`\n   Product ${index + 1}:`);
          console.log('     ID:', product.id);
          console.log('     Title:', product.title);
        });
      } else {
        console.log('   Response structure:', Object.keys(data));
        console.log('   Full response:', JSON.stringify(data, null, 2).substring(0, 500));
      }
    } else {
      console.log('   ❌ Error response:', data);
    }

    // Test 2: Try GraphQL endpoint like your friend showed
    console.log('\n2️⃣ Testing GraphQL endpoint...');
    
    const graphqlQuery = {
      query: `
        query ListProducts($companyId: ID!) {
          company(id: $companyId) {
            id
            title
            accessPasses {
              nodes {
                id
                title
                visibility
                shortenedDescription
              }
            }
          }
        }
      `,
      variables: {
        companyId: companyId
      }
    };

    const graphqlResponse = await fetch('https://whop.com/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    });

    console.log('   GraphQL Status:', graphqlResponse.status);
    
    if (graphqlResponse.ok) {
      const graphqlData = await graphqlResponse.json();
      console.log('   GraphQL Response:', JSON.stringify(graphqlData, null, 2).substring(0, 800));
      
      if (graphqlData.data?.company?.accessPasses?.nodes) {
        const passes = graphqlData.data.company.accessPasses.nodes;
        console.log(`\n   Found ${passes.length} access passes (products)`);
        passes.forEach(pass => {
          console.log(`     - ${pass.id}: ${pass.title} (${pass.visibility})`);
        });
      }
    } else {
      const errorData = await graphqlResponse.text();
      console.log('   GraphQL Error:', errorData);
    }

    // Test 3: Try without Bearer prefix (just API key)
    console.log('\n3️⃣ Testing with API key directly (no Bearer)...');
    
    const directResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      }
    });

    console.log('   Direct API key status:', directResponse.status);
    
    if (!directResponse.ok) {
      const errorText = await directResponse.text();
      console.log('   Error:', errorText.substring(0, 200));
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

testRestAPI().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('✅ Test complete!\n');
});