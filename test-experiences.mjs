#!/usr/bin/env node
import { WhopServerSdk } from '@whop/api';

const apiKey = 'apik_w9a0v4OB6VUfl_A2021772_C_f2b9c8d7d5c1902086d5da24c12541f8c45dc6382c7259a3e4d238c4cb2d89';
const appId = 'app_Z6bbsQEQUmRQQH';
const companyId = 'biz_2T7tC1fnFVo6d4';

console.log('\n🧪 Testing Whop Experiences API\n');
console.log('='.repeat(50));

const whopSdk = WhopServerSdk({
  appApiKey: apiKey,
  appId: appId,
});

try {
  // List experiences for the company
  console.log('📋 Listing experiences for company...\n');
  
  const experiences = await whopSdk.experiences.listExperiences({
    companyId: companyId,
    first: 50
  });
  
  console.log('Response received:', !!experiences);
  console.log('Response type:', typeof experiences);
  console.log('Response keys:', Object.keys(experiences || {}).join(', '));
  
  // Check different possible response structures
  if (experiences?.experiences) {
    console.log('\n✅ Found experiences field!');
    console.log('Has nodes?:', !!experiences.experiences.nodes);
    console.log('Node count:', experiences.experiences.nodes?.length || 0);
    
    if (experiences.experiences.nodes && experiences.experiences.nodes.length > 0) {
      console.log('\n📦 Experiences found:');
      experiences.experiences.nodes.forEach((exp, i) => {
        if (!exp) return;
        console.log(`\n${i + 1}. Experience:`);
        console.log('   ID:', exp.id);
        console.log('   Name:', exp.name || exp.title || 'N/A');
        console.log('   Type:', exp.type || 'N/A');
        console.log('   Price:', exp.price || 'N/A');
        console.log('   Visibility:', exp.visibility || exp.is_visible || 'N/A');
        console.log('   Fields:', Object.keys(exp).join(', '));
      });
    }
  } else if (Array.isArray(experiences)) {
    console.log(`\n📦 Direct array of ${experiences.length} experiences`);
    experiences.forEach((exp, i) => {
      console.log(`${i + 1}. ${exp.name || exp.title || exp.id}`);
    });
  } else {
    console.log('\n⚠️ No experiences found or unexpected response structure');
    console.log('Full response:', JSON.stringify(experiences, null, 2));
  }
  
  // Also try listing access passes directly
  console.log('\n' + '='.repeat(50));
  console.log('📋 Listing access passes...\n');
  
  const accessPasses = await whopSdk.companies.listAccessPasses({
    companyId: companyId,
    first: 50
  });
  
  console.log('Response received:', !!accessPasses);
  if (accessPasses) {
    console.log('Response keys:', Object.keys(accessPasses).join(', '));
    console.log('Full response:', JSON.stringify(accessPasses, null, 2).substring(0, 1000));
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Full error:', error);
}

console.log('\n' + '='.repeat(50));
console.log('✅ Test complete!\n');