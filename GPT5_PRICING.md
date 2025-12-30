# GPT-5 Model Pricing & Implementation

## Current Models (December 2025)

### GPT-5 nano (Default - Best Value)
**Model Identifier:** `gpt-5-nano`
- **Input:** $0.05 per 1M tokens ($0.00005 per 1K tokens)
- **Cached Input:** $0.005 per 1M tokens
- **Output:** $0.40 per 1M tokens ($0.0004 per 1K tokens)
- **Average Cost:** ~$0.00023 per 1K tokens
- **Context Window:** ~400,000 tokens
- **Max Output:** ~128,000 tokens
- **Best For:** High-volume support, FAQs, classification

### GPT-5 mini
**Model Identifier:** `gpt-5-mini`
- **Input:** $0.25 per 1M tokens ($0.00025 per 1K tokens)
- **Cached Input:** $0.025 per 1M tokens
- **Output:** $2.00 per 1M tokens ($0.002 per 1K tokens)
- **Average Cost:** ~$0.00113 per 1K tokens
- **Best For:** Complex support, technical questions

### GPT-5 (Standard)
**Model Identifier:** `gpt-5`
- **Input:** $1.25 per 1M tokens ($0.00125 per 1K tokens)
- **Cached Input:** $0.125 per 1M tokens
- **Output:** $10.00 per 1M tokens ($0.01 per 1K tokens)
- **Average Cost:** ~$0.00563 per 1K tokens
- **Best For:** Advanced reasoning, code analysis

## Implementation in Your Code

### Current Configuration (Updated)

```javascript
// convex/seed.ts
const plans = {
  free: {
    aiModels: ["gpt-5-nano"],  // Most cost-effective
    aiResponsesPerMonth: 20,
  },
  pro: {
    aiModels: ["gpt-5-nano", "gpt-5-mini"],
    aiResponsesPerMonth: 5000,
  },
  elite: {
    aiModels: ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
    aiResponsesPerMonth: 25000,
  }
};
```

### API Call Example

```javascript
// convex/ai/chatCompletions.ts
const completion = await openai.chat.completions.create({
  model: company.selectedAiModel || "gpt-5-nano",
  messages: chatMessages,
  temperature: 0.7,
  max_tokens: getMaxTokens(company.aiResponseLength || "medium"),
  presence_penalty: 0.1,
  frequency_penalty: 0.1
});
```

## Cost Analysis for Customer Support

### Per 1,000 Token Costs (Typical Support Reply)

| Model | Input + Output Cost | vs GPT-4o-mini | vs GPT-4 |
|-------|-------------------|----------------|----------|
| **GPT-5-nano** | $0.00023 | -40% cheaper | 99.5% cheaper |
| **GPT-5-mini** | $0.00113 | 3x more | 97.5% cheaper |
| **GPT-5** | $0.00563 | 15x more | 87.5% cheaper |
| **GPT-4o-mini** | $0.00038 | baseline | 99% cheaper |
| **GPT-4** | $0.045 | 118x more | baseline |

### Monthly API Costs by Plan

Assuming average 500 tokens per support reply:

**Free Plan (20 responses/month):**
- GPT-5-nano: $0.002 total cost
- Margin: 100% (free tier)

**Pro Plan (5,000 responses/month at $19):**
- GPT-5-nano: $0.58 total cost
- Margin: 97% ($18.42 profit)

**Elite Plan (25,000 responses/month at $49):**
- GPT-5-nano: $2.88 total cost
- GPT-5 (if used): $70.38 total cost
- Margin with nano: 94% ($46.12 profit)
- Margin with GPT-5: -44% ($21.38 loss - need to limit!)

## Recommendations

1. **Use GPT-5-nano as default** - It's 40% cheaper than GPT-4o-mini with better performance
2. **Limit GPT-5 standard** - Only for complex queries to maintain margins
3. **Implement caching** - Use cached input pricing for 90% savings on repeated context
4. **Monitor usage** - Track which model is being used per query

## Updated Pricing Plans for Marketing

### Token-Based Transparent Pricing

**Free Trial:** 50,000 tokens/month
- ≈ 100-200 support replies (GPT-5-nano)

**Starter ($49):** 2,000,000 tokens/month  
- ≈ 4,000-8,000 support replies (GPT-5-nano)
- ≈ 1,700-3,500 replies (GPT-5-mini)

**Professional ($149):** 6,000,000 tokens/month
- ≈ 12,000-24,000 support replies (GPT-5-nano)
- ≈ 5,000-10,000 replies (GPT-5-mini)

**Business ($399):** 20,000,000 tokens/month
- ≈ 40,000-80,000 support replies (GPT-5-nano)
- ≈ 17,000-35,000 replies (GPT-5-mini)
- ≈ 3,500-7,000 replies (GPT-5)

## Environment Variable Update

Add to your .env.local:
```
# Default AI Model
DEFAULT_AI_MODEL=gpt-5-nano

# Model Pricing (for tracking)
GPT5_NANO_INPUT_COST=0.00005
GPT5_NANO_OUTPUT_COST=0.0004
GPT5_MINI_INPUT_COST=0.00025
GPT5_MINI_OUTPUT_COST=0.002
GPT5_INPUT_COST=0.00125
GPT5_OUTPUT_COST=0.01
```