"use node";

import { action } from "../_generated/server";

export const checkWhopEnv = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.WHOP_API_KEY;
    const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
    
    return {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 20) : 'not set',
      apiKeySuffix: apiKey ? apiKey.substring(apiKey.length - 10) : 'not set',
      hasAppId: !!appId,
      appId: appId || 'not set',
      whopEnvVars: Object.keys(process.env).filter(k => k.includes('WHOP')).sort()
    };
  }
});