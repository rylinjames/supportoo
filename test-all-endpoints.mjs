#!/usr/bin/env node
import { WhopServerSdk } from '@whop/api';

const apiKey = 'apik_w9a0v4OB6VUfl_A2021772_C_f2b9c8d7d5c1902086d5da24c12541f8c45dc6382c7259a3e4d238c4cb2d89';
const appId = 'app_Z6bbsQEQUmRQQH';
const companyId = 'biz_2T7tC1fnFVo6d4'; // BooKoo Apps

console.log('\n🧪 Testing ALL Whop Product/Plan Endpoints\n');
console.log('='.repeat(50));

const whopSdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

console.log('✅ SDK initialized');
console.log('  Company: BooKoo Apps');
console.log('  Company ID:', companyId);

async function testEndpoint(name, method, args) {
  console.log(`\n📋 Testing ${name}...`);
  try {
    const result = await method(args);
    console.log(`  ✅ Success!`);
    
    // Check various possible response structures
    const possibleFields = ['products', 'plans', 'items', 'nodes', 'data', 'results'];
    let foundData = false;
    
    for (const field of possibleFields) {
      if (result?.[field]) {
        const items = result[field]?.nodes || result[field];
        const count = Array.isArray(items) ? items.length : (items ? 1 : 0);
        if (count > 0) {
          console.log(`  📦 Found ${count} items in "${field}"`);
          foundData = true;
          
          // Show first item structure
          const firstItem = Array.isArray(items) ? items[0] : items;
          if (firstItem) {
            console.log(`\n  First item details:`);
            console.log('    ID:', firstItem.id || 'N/A');
            console.log('    Title/Name:', firstItem.title || firstItem.name || 'N/A');
            console.log('    Price:', firstItem.price || 'N/A');
            console.log('    Visibility:', firstItem.visibility || firstItem.is_visible || firstItem.isVisible || 'N/A');
            console.log('    Status:', firstItem.status || firstItem.is_active || firstItem.isActive || 'N/A');
            console.log('    Type:', firstItem.type || firstItem.category || 'N/A');
            console.log('\n    Available fields:', Object.keys(firstItem).slice(0, 15).join(', '));
            
            // Show all items briefly
            if (Array.isArray(items) && items.length > 1) {
              console.log('\n  All items:');
              items.forEach((item, i) => {
                console.log(`    ${i + 1}. ${item.title || item.name || item.id || 'Unknown'}`);
              });
            }
          }
        }
      }
    }
    
    if (!foundData) {
      // Try to understand the response structure
      console.log('  ⚠️ No standard data fields found');
      console.log('  Response type:', typeof result);
      if (result && typeof result === 'object') {
        console.log('  Response keys:', Object.keys(result).join(', '));
        
        // Check if it's a direct array
        if (Array.isArray(result)) {
          console.log(`  📦 Direct array with ${result.length} items`);
          if (result.length > 0) {
            console.log('  First item:', JSON.stringify(result[0], null, 2).substring(0, 500));
          }
        } else {
          // Show the structure
          console.log('  Response preview:', JSON.stringify(result, null, 2).substring(0, 500));
        }
      }
    }
    
    return result;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

// Test all possible product-related endpoints
console.log('\n' + '='.repeat(50));
console.log('🔍 TESTING ALL ENDPOINTS');
console.log('='.repeat(50));

// 1. Company endpoints
await testEndpoint('companies.listPlans', whopSdk.companies.listPlans, {
  companyId,
  first: 50
});

// Check if there's a listProducts method
if (whopSdk.companies.listProducts) {
  await testEndpoint('companies.listProducts', whopSdk.companies.listProducts, {
    companyId,
    first: 50
  });
} else {
  console.log('\n❌ companies.listProducts method not found');
}

// 2. Check if there's a products namespace
if (whopSdk.products) {
  console.log('\n✅ Found products namespace! Methods:', Object.keys(whopSdk.products).join(', '));
  
  if (whopSdk.products.list) {
    await testEndpoint('products.list', whopSdk.products.list, {
      companyId,
      first: 50
    });
  }
  
  if (whopSdk.products.getAll) {
    await testEndpoint('products.getAll', whopSdk.products.getAll, {
      companyId
    });
  }
} else {
  console.log('\n❌ No products namespace found');
}

// 3. Check if there's a plans namespace
if (whopSdk.plans) {
  console.log('\n✅ Found plans namespace! Methods:', Object.keys(whopSdk.plans).join(', '));
  
  if (whopSdk.plans.list) {
    await testEndpoint('plans.list', whopSdk.plans.list, {
      companyId,
      first: 50
    });
  }
} else {
  console.log('\n❌ No plans namespace found');
}

// 4. Try memberships (might be related)
await testEndpoint('companies.listMemberships', whopSdk.companies.listMemberships, {
  companyId,
  first: 50
});

// 5. Try access passes
await testEndpoint('companies.listAccessPasses', whopSdk.companies.listAccessPasses, {
  companyId,
  first: 50
});

// 6. Check experiences namespace (might contain products)
if (whopSdk.experiences) {
  console.log('\n✅ Found experiences namespace! Methods:', Object.keys(whopSdk.experiences).join(', '));
  
  if (whopSdk.experiences.list) {
    await testEndpoint('experiences.list', whopSdk.experiences.list, {
      companyId,
      first: 50
    });
  }
} else {
  console.log('\n❌ No experiences namespace found');
}

// 7. Show all available SDK namespaces for reference
console.log('\n' + '='.repeat(50));
console.log('📚 ALL SDK NAMESPACES:');
console.log('='.repeat(50));
Object.keys(whopSdk).forEach(namespace => {
  const methods = whopSdk[namespace] && typeof whopSdk[namespace] === 'object' 
    ? Object.keys(whopSdk[namespace]).filter(k => typeof whopSdk[namespace][k] === 'function')
    : [];
  if (methods.length > 0) {
    console.log(`\n${namespace}:`);
    methods.forEach(method => {
      console.log(`  - ${namespace}.${method}()`);
    });
  }
});

console.log('\n' + '='.repeat(50));
console.log('✅ Test complete!\n');