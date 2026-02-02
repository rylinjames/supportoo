import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Whop from '@whop/sdk';

const companyId = 'biz_2T7tC1fnFVo6d4';

// Simulate what would happen with a user token
// The userToken comes from Whop OAuth when user logs in
console.log('Testing SDK initialization options...\n');

// Check SDK constructor options
const sdkInstance = new Whop.__proto__.constructor;
console.log('SDK accepts these options:');

// Look at actual SDK source
import { readFileSync } from 'fs';
const sdkPath = './node_modules/@whop/sdk/client.mjs';
const content = readFileSync(sdkPath, 'utf8').substring(0, 3000);
console.log('\nSDK client.mjs (first 3000 chars):');
console.log(content);

