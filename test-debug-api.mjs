#!/usr/bin/env node

/**
 * Debug test to check what's happening with the API
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const apiKey = process.env.WHOP_API_KEY;

console.log('\n🔍 Debugging Whop API Access\n');
console.log('='.repeat(50));

// Test 1: Check if we can access ANY endpoint
console.log('\n1️⃣ Testing basic API access (user info)...');
try {
  const userResponse = await fetch('https://api.whop.com/api/v1/users/@me', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    }
  });
  
  console.log('   Status:', userResponse.status);
  const userData = await userResponse.json();
  console.log('   Response:', JSON.stringify(userData, null, 2).substring(0, 300));
} catch (e) {
  console.log('   Error:', e.message);
}

// Test 2: Check app info
console.log('\n2️⃣ Testing app access...');
try {
  const appResponse = await fetch(`https://api.whop.com/api/v1/apps/${process.env.NEXT_PUBLIC_WHOP_APP_ID}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    }
  });
  
  console.log('   Status:', appResponse.status);
  const appData = await appResponse.json();
  console.log('   Response:', JSON.stringify(appData, null, 2).substring(0, 300));
} catch (e) {
  console.log('   Error:', e.message);
}

// Test 3: Try different product endpoint variations
console.log('\n3️⃣ Testing product endpoint variations...');

const variations = [
  'https://api.whop.com/api/v1/products?company_id=biz_2T7tC1fnFVo6d4',
  'https://api.whop.com/api/v2/products?company_id=biz_2T7tC1fnFVo6d4',
  'https://api.whop.com/api/v1/companies/biz_2T7tC1fnFVo6d4/products',
  'https://api.whop.com/api/v1/companies/biz_2T7tC1fnFVo6d4/access_passes',
];

for (const url of variations) {
  console.log(`\n   Testing: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      }
    });
    
    console.log(`   Status: ${response.status}`);
    if (response.status !== 404) {
      const text = await response.text();
      console.log(`   Response: ${text.substring(0, 150)}`);
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
}

console.log('\n' + '='.repeat(50));
console.log('✅ Debug complete!\n');