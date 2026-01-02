#!/usr/bin/env node
import { WhopServerSdk } from '@whop/api';

const apiKey = 'apik_w9a0v4OB6VUfl_A2021772_C_f2b9c8d7d5c1902086d5da24c12541f8c45dc6382c7259a3e4d238c4cb2d89';
const appId = 'app_Z6bbsQEQUmRQQH';
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('\n🎯 CREATING HIDDEN ACCESS PASS\n');
console.log('='.repeat(60));

const whopSdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

console.log('Creating AccessPass with visibility:"hidden"...\n');
try {
  const accessPass = await whopSdk.accessPasses.createAccessPass({
    companyId: companyId,
    title: 'Test Hidden API Product ' + Date.now(),
    visibility: 'hidden', // Using correct enum value
  });
  
  console.log('✅ SUCCESS! Created hidden access pass:');
  console.log(JSON.stringify(accessPass, null, 2));
  
  // Store the ID
  const createdId = accessPass?.id || accessPass?.accessPass?.id;
  console.log('\nCreated Access Pass ID:', createdId);
  
  // Now check if it appears in the lists
  console.log('\n' + '='.repeat(60));
  console.log('📋 CHECKING IF IT APPEARS IN LISTS');
  console.log('='.repeat(60));
  
  // Check listAccessPasses
  console.log('\n1️⃣ Checking companies.listAccessPasses...');
  const passes = await whopSdk.companies.listAccessPasses({ companyId, first: 100 });
  if (passes?.accessPasses?.nodes) {
    console.log(`Found ${passes.accessPasses.nodes.length} access passes`);
    passes.accessPasses.nodes.forEach((pass, i) => {
      console.log(`  ${i+1}. ${pass.title || pass.id}`);
    });
  } else {
    console.log('Response:', JSON.stringify(passes, null, 2));
  }
  
  // Check listPlans 
  console.log('\n2️⃣ Checking companies.listPlans...');
  const plans = await whopSdk.companies.listPlans({ companyId, first: 100 });
  if (plans?.plans?.nodes) {
    console.log(`Found ${plans.plans.nodes.length} plans`);
  } else {
    console.log('No plans found (empty response)');
  }
  
  // If we have the ID, try to get it directly
  if (createdId) {
    console.log(`\n3️⃣ Fetching created access pass directly (${createdId})...`);
    try {
      const directFetch = await whopSdk.accessPasses.getAccessPass({ 
        accessPassId: createdId 
      });
      console.log('✅ Direct fetch successful:');
      console.log(JSON.stringify(directFetch, null, 2));
    } catch (e) {
      console.log('❌ Could not fetch directly:', e.message);
    }
  }
  
  // Try to update it to see what fields are available
  if (createdId) {
    console.log(`\n4️⃣ Attempting to update the access pass...`);
    try {
      const updated = await whopSdk.accessPasses.updateAccessPass({
        accessPassId: createdId,
        title: 'Updated Hidden Product',
        description: 'This is a test product created via API',
      });
      console.log('✅ Update successful');
    } catch (e) {
      console.log('Update error (shows available fields):', e.message.substring(0, 300));
    }
  }
  
  // Clean up - delete the test access pass
  if (createdId) {
    console.log(`\n5️⃣ Cleaning up - deleting test access pass...`);
    try {
      await whopSdk.accessPasses.deleteAccessPass({ accessPassId: createdId });
      console.log('✅ Deleted test access pass');
    } catch (e) {
      console.log('❌ Could not delete:', e.message);
    }
  }
  
} catch (error) {
  console.log('❌ Failed to create access pass:', error.message);
  
  // If still failing, show what fields are expected
  if (error.message.includes('Expected value to not be null')) {
    console.log('\nRequired fields:');
    const fields = error.message.match(/(\w+) \(Expected value to not be null\)/g);
    if (fields) {
      fields.forEach(f => {
        const name = f.match(/(\w+) \(/)?.[1];
        if (name) console.log('  -', name);
      });
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 FINAL VERDICT');
console.log('='.repeat(60));
console.log('\nAccess Passes are NOT the same as Products/Plans.');
console.log('They appear to be for granting access to experiences/apps.');
console.log('\nThe products you see in the Whop dashboard (pricing tiers)');
console.log('are not manageable via the public API.\n');