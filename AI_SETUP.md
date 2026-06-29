# AI Service Configuration Guide

This guide explains how to use OpenAI or Google Cloud Vertex AI in the LeadRep backend.

## Overview

The AI service can be configured to use either:
- **OpenAI** (Default) - Azure OpenAI endpoint
- **Google Cloud Vertex AI** - Google's AI models (Gemini)

## Quick Start: Vertex AI

### 1. Setup Google Cloud Credentials

**Option A: Using Application Default Credentials (ADC)**

```bash
# Set the path to your GCP credentials JSON file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/ai-config.json"

# Or copy the file to the secrets directory
cp ai-config.json /Users/APPLE/Desktop/Projects/LeadRep/mansa-backend/secrets/
```

**Option B: Using gcloud CLI**

```bash
gcloud auth application-default login
```

### 2. Set Environment Variables

Add to your `.env` file in the backend directory:

```env
# AI Provider: "openai" or "vertexai"
AI_PROVIDER=vertexai

# GCP Configuration
GCP_PROJECT_ID=ornate-casing-444308-t1
GCP_LOCATION=us-central1
GOOGLE_CLOUD_PROJECT=ornate-casing-444308-t1

# Vertex AI Model Configuration
VERTEX_AI_MODEL=gemini-1.5-flash
VERTEX_AI_MAX_TOKENS=2000
VERTEX_AI_TEMPERATURE=0.0

# If using ADC file
GOOGLE_APPLICATION_CREDENTIALS=secrets/ai-config.json
```

### 3. Update Usage in Controllers

Replace imports from `openai.ts` with `aiConfig.ts`:

**Before:**
```typescript
import { getAICompletion } from "../utils/services/ai/openai";
```

**After:**
```typescript
import { getAIService } from "../utils/services/ai/aiConfig";
import { aiConfigManager } from "../utils/services/ai/aiConfig";
```

### 4. Using the AI Service

#### Option A: Simple Prompt Completion

```typescript
import { getVertexAIService } from "../utils/services/ai/vertexai";

const service = getVertexAIService();
const response = await service.generateContent("Your prompt here");
```

#### Option B: With Custom Configuration

```typescript
import { getVertexAIService } from "../utils/services/ai/vertexai";

const service = getVertexAIService({
  model: "gemini-1.5-pro",
  maxTokens: 4000,
  temperature: 0.7,
});

const response = await service.generateContent("Your prompt here");
```

#### Option C: Using Config Manager (Provider Agnostic)

```typescript
import { aiConfigManager, getAIService } from "../utils/services/ai/aiConfig";

// Check current provider
console.log(aiConfigManager.getProvider()); // "vertexai" or "openai"

// Get the appropriate service
const service = await getAIService();
const response = await service.generateContent("Your prompt here");

// Switch provider at runtime
aiConfigManager.setProvider("vertexai");
```

## Vertex AI Service API

### `VertexAIService` Class

#### Methods

##### `generateContent(prompt: string, options?: Partial<VertexAIConfig>): Promise<string>`

Generate content from a prompt.

```typescript
const response = await service.generateContent(
  "Analyze these leads and score them",
  { temperature: 0.2 }
);
```

##### `evaluateLeads(leadsData: any[], preferences: any): Promise<string>`

Evaluate leads based on user preferences (returns JSON string).

```typescript
const evaluation = await service.evaluateLeads(leads, userPreferences);
const result = JSON.parse(evaluation);
```

##### `evaluateCustomerPreference(data: any): Promise<any>`

Evaluate customer data and return structured insights.

```typescript
const insights = await service.evaluateCustomerPreference(userData);
// Returns: { icp_summary, bp_profile, market_insights, recommended_focus_areas }
```

## Configuration Parameters

### VertexAIConfig

```typescript
interface VertexAIConfig {
  projectId: string;      // GCP Project ID
  location: string;       // Region (default: us-central1)
  model: string;          // Model name (default: gemini-1.5-flash)
  maxTokens?: number;     // Max output tokens (default: 2000)
  temperature?: number;   // Response temperature (default: 0.0)
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | "openai" or "vertexai" | "openai" |
| `GCP_PROJECT_ID` | Google Cloud Project ID | "ornate-casing-444308-t1" |
| `GCP_LOCATION` | GCP region | "us-central1" |
| `VERTEX_AI_MODEL` | Model to use | "gemini-1.5-flash" |
| `VERTEX_AI_MAX_TOKENS` | Max output tokens | "2000" |
| `VERTEX_AI_TEMPERATURE` | Response temperature | "0.0" |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP credentials file | (optional) |

## Available Vertex AI Models

- `gemini-1.5-flash` - Fast, efficient model for quick tasks
- `gemini-1.5-pro` - More powerful model for complex reasoning
- `gemini-2.0-flash` (if available) - Latest model
- `text-bison` - Text generation model
- `text-unicorn` - High-performance text model

## Error Handling

The Vertex AI service includes automatic retry logic:
- **Retry on**: Rate limits (429), Service unavailable (503)
- **Max attempts**: 3
- **Backoff strategy**: Exponential (1s, 2s, 4s)

```typescript
try {
  const response = await service.generateContent(prompt);
} catch (error) {
  console.error("AI service failed:", error.message);
  // Handle error appropriately
}
```

## Migration Checklist

To migrate from OpenAI to Vertex AI:

- [ ] Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- [ ] Set `AI_PROVIDER=vertexai` in `.env`
- [ ] Update `.env` with GCP configuration
- [ ] Update controller imports to use `aiConfig.ts`
- [ ] Test AI features (chat, lead evaluation, email generation)
- [ ] Verify responses match expected format
- [ ] Monitor logs for any auth or API errors
- [ ] Remove `OPENAI_API_KEY` and `OPENAI_ENDPOINT` if not needed

## Troubleshooting

### "Could not initialize Vertex AI authentication"

**Solution**: Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to valid GCP credentials file.

```bash
ls -la $GOOGLE_APPLICATION_CREDENTIALS
```

### "No content in Vertex AI response"

**Solution**: Check that the model and configuration are correct. Verify the response structure:

```typescript
console.log(JSON.stringify(response, null, 2));
```

### "Failed to get completion from Vertex AI"

**Solution**: 
- Check GCP project ID is correct
- Verify API quotas in GCP Console
- Check network connectivity to Vertex AI API
- Review logs for detailed error messages

### Rate Limiting Issues

The service automatically retries on rate limits. To reduce issues:

1. Increase `VERTEX_AI_MAX_TOKENS` if consistent 503 errors
2. Use `gemini-1.5-flash` for better rate limits
3. Implement request queuing for bulk operations

## Performance Optimization

### Model Selection

- **For speed**: Use `gemini-1.5-flash` (recommended default)
- **For quality**: Use `gemini-1.5-pro`
- **For long contexts**: Use `gemini-1.5-pro`

### Temperature Settings

- **0.0** - Deterministic, consistent responses (evaluation, scoring)
- **0.5-0.7** - Balanced, for creative but controlled responses
- **0.9+** - Creative, varied responses (not recommended for structured data)

### Token Budget

- Keep `maxTokens` reasonable for your use case
- For evaluations: 2000 tokens is usually sufficient
- For detailed analysis: use 4000+

## Cost Estimation

Vertex AI pricing varies by model. Reference:
- **Gemini 1.5 Flash**: ~$0.075/1M input tokens, ~$0.30/1M output tokens
- **Gemini 1.5 Pro**: ~$3.50/1M input tokens, ~$10.50/1M output tokens

Monitor usage via Google Cloud Console.

## Files Created

- `/src/utils/services/ai/vertexai.ts` - Vertex AI service implementation
- `/src/utils/services/ai/aiConfig.ts` - Configuration manager and provider selector
- `/AI_SETUP.md` - This documentation file

## Next Steps

1. Copy `ai-config.json` to `secrets/` folder
2. Update `.env` with configuration
3. Test with a simple prompt
4. Gradually migrate controllers to use new service
5. Monitor performance and costs
