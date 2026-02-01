#!/usr/bin/env node

/**
 * Test AI response using simulate functions
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testAIResponse() {
  console.log('🧪 Testing AI Response System using simulate functions...\n');
  
  try {
    // Create test customer
    console.log('Creating test customer...');
    const { stdout: customerOutput } = await execPromise(
      `npx convex run simulate:createTestCustomer '{"companyId": "j97bzdg4qk2cqhzwg5y6ryrk6n7ts3qb"}'`
    );
    const customerData = JSON.parse(customerOutput);
    const customerId = customerData.customerId;
    console.log('✓ Created test customer:', customerData);
    
    // Create test conversation
    console.log('\nCreating test conversation...');
    const { stdout: convOutput } = await execPromise(
      `npx convex run simulate:createTestConversation '{"companyId": "j97bzdg4qk2cqhzwg5y6ryrk6n7ts3qb"}'`
    );
    const convData = JSON.parse(convOutput);
    const conversationId = convData.conversationId;
    console.log('✓ Created test conversation:', convData);
    
    // Send customer message
    console.log('\nSending customer message: "who do you work for"...');
    const { stdout: replyOutput } = await execPromise(
      `npx convex run simulate:simulateCustomerReply '{"conversationId": "${conversationId}", "message": "who do you work for"}'`
    );
    console.log('✓ Customer message sent');
    
    // Wait for AI response
    console.log('\nWaiting 15 seconds for AI to process...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Get messages
    console.log('Fetching conversation messages...');
    const { stdout: messagesOutput } = await execPromise(
      `npx convex run messages/queries:getMessages '{"conversationId": "${conversationId}", "limit": 10}'`
    );
    const messages = JSON.parse(messagesOutput);
    
    console.log('\n📝 Conversation Messages:');
    console.log('═══════════════════════════════════════════');
    messages.reverse().forEach(msg => {
      const timestamp = new Date(msg._creationTime).toLocaleTimeString();
      console.log(`[${timestamp}] ${msg.role.toUpperCase()}: ${msg.content}`);
      if (msg.role === 'ai') {
        console.log(`  └─ Model: ${msg.aiModel || 'unknown'}, Time: ${msg.processingTime || 0}ms`);
      }
    });
    
    // Analyze the response
    const aiMessages = messages.filter(m => m.role === 'ai');
    console.log('\n🔍 Analysis Results:');
    console.log('═══════════════════════════════════════════');
    
    if (aiMessages.length > 0) {
      const lastAiMessage = aiMessages[aiMessages.length - 1];
      const content = lastAiMessage.content.toLowerCase();
      
      // Check various indicators
      const checks = {
        'AI responded': aiMessages.length > 0,
        'Mentions Oscorp': content.includes('oscorp'),
        'Mentions Green Goblin': content.includes('green goblin'),
        'Uses generic fallback': content.includes("i'd be happy to help you with that!"),
        'Says "AI assistant"': content.includes('ai assistant'),
        'Has proper context': content.includes('oscorp') || content.includes('green goblin')
      };
      
      Object.entries(checks).forEach(([check, result]) => {
        console.log(`${result ? '✅' : '❌'} ${check}`);
      });
      
      // Overall assessment
      console.log('\n📊 Final Assessment:');
      if (checks['Has proper context'] && !checks['Uses generic fallback']) {
        console.log('✅ SUCCESS: AI is using company context correctly!');
      } else {
        console.log('❌ FAILURE: AI is not using company context');
        console.log('\nExpected: AI should mention working for Oscorp or Green Goblin');
        console.log('Actual: AI gave a generic response');
      }
    } else {
      console.log('❌ No AI response received');
    }
    
    // Check conversation status
    console.log('\n📋 Conversation Status:');
    const { stdout: statusOutput } = await execPromise(
      `npx convex run simulate:getConversationStatus '{"conversationId": "${conversationId}"}'`
    );
    const status = JSON.parse(statusOutput);
    console.log('Status:', status);
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    if (error.stderr) console.log('Error details:', error.stderr);
  }
}

// Run test
testAIResponse().catch(console.error);