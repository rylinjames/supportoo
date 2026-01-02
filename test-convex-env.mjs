#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// Create a simple action to test env vars
const testEnvVars = `
export default async function() {
  const apiKey = process.env.WHOP_API_KEY;
  const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
  
  return {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) : 'not set',
    hasAppId: !!appId,
    appId: appId || 'not set',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('WHOP')).sort()
  };
}`;

// Run test via Convex CLI instead
console.log('\n🔍 Testing Whop environment variables in Convex...\n');
console.log('Run this command to check:');
console.log('npx convex run --code "() => { return { apiKey: process.env.WHOP_API_KEY?.substring(0, 20), appId: process.env.NEXT_PUBLIC_WHOP_APP_ID } }"');