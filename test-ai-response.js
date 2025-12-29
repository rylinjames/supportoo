#!/usr/bin/env node

/**
 * Test script to simulate customer message and check AI response
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testAIResponse() {
  console.log('🧪 Testing AI Response System...\n');
  
  // Test 1: Simple question about who they work for
  console.log('Test 1: Asking "who do you work for"');
  console.log('----------------------------------------');
  
  try {
    // First, we need to create a conversation and send a message
    // We'll use the Convex CLI to run the mutation directly
    
    // Create a test user (customer)
    const createUserCmd = `npx convex run users/mutations:createUser '{"whopUserId": "test_customer_${Date.now()}", "displayName": "Test Customer", "email": "test@example.com", "role": "customer", "whopUsername": "testcustomer", "companyId": "j97bzdg4qk2cqhzwg5y6ryrk6n7ts3qb"}'`;
    
    console.log('Creating test customer...');
    const { stdout: userOutput } = await execPromise(createUserCmd);
    const userId = JSON.parse(userOutput).userId;
    console.log('✓ Created test customer:', userId);
    
    // Create a conversation
    const createConvCmd = `npx convex run conversations/mutations:createConversation '{"customerId": "${userId}", "companyId": "j97bzdg4qk2cqhzwg5y6ryrk6n7ts3qb"}'`;
    
    console.log('\nCreating test conversation...');
    const { stdout: convOutput } = await execPromise(createConvCmd);
    const conversationId = JSON.parse(convOutput);
    console.log('✓ Created test conversation:', conversationId);
    
    // Send a customer message
    const sendMessageCmd = `npx convex run messages/mutations:sendCustomerMessage '{"conversationId": "${conversationId}", "customerId": "${userId}", "content": "who do you work for", "companyId": "j97bzdg4qk2cqhzwg5y6ryrk6n7ts3qb", "experienceId": "test_experience"}'`;
    
    console.log('\nSending test message: "who do you work for"...');
    await execPromise(sendMessageCmd);
    console.log('✓ Message sent, AI should respond...');
    
    // Wait for AI response
    console.log('\nWaiting 10 seconds for AI response...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Get messages from conversation
    const getMessagesCmd = `npx convex run messages/queries:getMessages '{"conversationId": "${conversationId}", "limit": 10}'`;
    
    console.log('Fetching messages...');
    const { stdout: messagesOutput } = await execPromise(getMessagesCmd);
    const messages = JSON.parse(messagesOutput);
    
    console.log('\n📝 Conversation Messages:');
    console.log('------------------------');
    messages.reverse().forEach(msg => {
      console.log(`${msg.role.toUpperCase()}: ${msg.content}`);
      if (msg.role === 'ai') {
        console.log(`  (Model: ${msg.aiModel || 'unknown'}, Processing: ${msg.processingTime}ms)`);
      }
    });
    
    // Check if AI mentioned Oscorp
    const aiMessages = messages.filter(m => m.role === 'ai');
    if (aiMessages.length > 0) {
      const lastAiMessage = aiMessages[aiMessages.length - 1];
      const mentionsOscorp = lastAiMessage.content.toLowerCase().includes('oscorp');
      const isGenericMessage = lastAiMessage.content.includes("I'd be happy to help you with that!");
      
      console.log('\n🔍 Analysis:');
      console.log('------------');
      console.log('✓ AI responded:', aiMessages.length > 0);
      console.log(mentionsOscorp ? '✓ Mentions Oscorp' : '✗ Does NOT mention Oscorp');
      console.log(isGenericMessage ? '✗ Uses generic fallback message' : '✓ Uses proper response');
      
      if (!mentionsOscorp || isGenericMessage) {
        console.log('\n❌ TEST FAILED: AI is not using company context properly');
      } else {
        console.log('\n✅ TEST PASSED: AI correctly identifies working for Oscorp');
      }
    } else {
      console.log('\n❌ TEST FAILED: No AI response received');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    if (error.stdout) console.log('Output:', error.stdout);
    if (error.stderr) console.log('Error output:', error.stderr);
  }
}

// Run the test
testAIResponse().catch(console.error);