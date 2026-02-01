#!/usr/bin/env node

/**
 * Check what instructions the assistant actually has
 */

const OpenAI = require('openai');

async function checkAssistant() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const assistantId = 'asst_3LcxfPagr2uZQgymS692jiyv';
  
  console.log('Fetching assistant configuration...\n');
  const assistant = await openai.beta.assistants.retrieve(assistantId);
  
  console.log('Assistant Name:', assistant.name);
  console.log('Model:', assistant.model);
  console.log('\n=== INSTRUCTIONS ===\n');
  console.log(assistant.instructions);
  console.log('\n=== TOOLS ===\n');
  console.log(JSON.stringify(assistant.tools, null, 2));
  console.log('\n=== TOOL RESOURCES ===\n');
  console.log(JSON.stringify(assistant.tool_resources, null, 2));
}

checkAssistant().catch(console.error);