import { ModelAdapter, ModelConfig } from "../types"; // Import types
import { BaseModelAdapter } from "./base"; // Import base adapter
import { GeminiAdapter } from "./gemini"; // Import Gemini adapter
import { config } from "../config/env"; // Import environment config

// Model factory class to create appropriate adapters
export class ModelFactory {
  // Create a model adapter based on provider
  static createAdapter(config: ModelConfig): ModelAdapter {
    switch (config.provider.toLowerCase()) {
      case "gemini":
        return new GeminiAdapter(config);

      case "openai":
        // Future: Add OpenAI adapter
        throw new Error("OpenAI adapter not yet implemented");

      default:
        throw new Error(`Unsupported model provider: ${config.provider}`);
    }
  }

  // Create adapter from environment configuration
  static createFromEnv(): ModelAdapter {
    const modelConfig: ModelConfig = {
      provider: config.MODEL_PROVIDER,
      model: config.MODEL_NAME,
      temperature: config.TEMPERATURE,
      maxTokens: config.MAX_TOKENS,
      apiKey: this.getApiKeyForProvider(config.MODEL_PROVIDER),
    };

    return this.createAdapter(modelConfig);
  }

  // Get the appropriate API key for the provider
  private static getApiKeyForProvider(provider: string): string {
    switch (provider.toLowerCase()) {
      case "gemini":
        if (!config.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY is required for Gemini provider");
        }
        return config.GEMINI_API_KEY;

      case "openai":
        if (!config.OPENAI_API_KEY) {
          throw new Error("OPENAI_API_KEY is required for OpenAI provider");
        }
        return config.OPENAI_API_KEY;

      default:
        throw new Error(`No API key configured for provider: ${provider}`);
    }
  }

  // Get list of supported providers
  static getSupportedProviders(): string[] {
    return ["gemini"]; // Add more providers as they are implemented
  }

  // Validate provider configuration
  static validateProviderConfig(provider: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    switch (provider.toLowerCase()) {
      case "gemini":
        if (!config.GEMINI_API_KEY) {
          errors.push("GEMINI_API_KEY is required");
        }
        break;

      case "openai":
        if (!config.OPENAI_API_KEY) {
          errors.push("OPENAI_API_KEY is required");
        }
        break;

      default:
        errors.push(`Unsupported provider: ${provider}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export adapter classes for direct use
export { BaseModelAdapter, GeminiAdapter };

// Export a singleton instance for convenience
export let modelAdapter: ModelAdapter;

// Initialize the model adapter (call this during app startup)
export function initializeModelAdapter(): ModelAdapter {
  try {
    modelAdapter = ModelFactory.createFromEnv();
    return modelAdapter;
  } catch (error) {
    throw new Error(
      `Failed to initialize model adapter: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Get the current model adapter instance
export function getModelAdapter(): ModelAdapter {
  if (!modelAdapter) {
    throw new Error(
      "Model adapter not initialized. Call initializeModelAdapter() first.",
    );
  }
  return modelAdapter;
}

// Reset the model adapter (useful for testing or provider switching)
export function resetModelAdapter(): void {
  modelAdapter = undefined as any; // Clear the instance
}

// Health check for the current model adapter
export async function checkModelHealth(): Promise<{
  provider: string;
  healthy: boolean;
  error?: string;
}> {
  try {
    const adapter = getModelAdapter();
    const isHealthy = await adapter.healthCheck();

    const result = {
      provider: adapter.getProvider(),
      healthy: isHealthy,
    } as { provider: string; healthy: boolean; error?: string };

    if (!isHealthy) {
      result.error = "Model adapter health check failed";
    }

    return result;
  } catch (error) {
    return {
      provider: "unknown",
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get model information
export async function getModelInfo(): Promise<{
  provider: string;
  model: string;
  capabilities?: any;
}> {
  try {
    const adapter = getModelAdapter();

    // Base info available for all adapters
    const info = {
      provider: adapter.getProvider(),
      model: "unknown", // Would need to be added to base interface
    };

    // Try to get additional info if available (Gemini specific)
    if (adapter instanceof GeminiAdapter) {
      const geminiInfo = await adapter.getModelInfo();
      return {
        ...info,
        model: geminiInfo.name,
        capabilities: {
          maxTokens: geminiInfo.maxTokens,
          supportedFeatures: geminiInfo.supportedFeatures,
        },
      };
    }

    return info;
  } catch (error) {
    throw new Error(
      `Failed to get model info: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
