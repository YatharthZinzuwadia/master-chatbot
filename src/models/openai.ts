import { OpenAI } from "openai"; // Import OpenAI
import { BaseModelAdapter } from "./base"; // Import base adapter
import { ModelConfig } from "../types"; // Import ModelConfig type

// OpenAI model adapter implementation
export class OpenAIAdapter extends BaseModelAdapter {
  private openai: OpenAI; // OpenAI client

  constructor(config: ModelConfig) {
    super(config); // Call parent constructor

    // Validate configuration
    this.validateConfig();

    // Initialize OpenAI client
    if (!this.config.apiKey) {
      throw new Error("API key is required for OpenAI adapter");
    }
    this.openai = new OpenAI({ apiKey: this.config.apiKey });
  }

  // Generate response using OpenAI API
  async generateResponse(prompt: string, config: ModelConfig): Promise<string> {
    try {
      // Sanitize and validate the prompt
      const sanitizedPrompt = this.sanitizePrompt(prompt);

      // Merge configuration with defaults
      const finalConfig = this.mergeConfig(config);

      // Generate completion with OpenAI
      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-3.5-turbo",
        messages: [{ role: "user", content: sanitizedPrompt }],
        temperature: finalConfig.temperature ?? null,
        max_tokens: finalConfig.maxTokens ?? null,
      });

      // Extract the text response
      const textResponse = response.choices[0]?.message?.content;

      if (!textResponse) {
        throw new Error("No response received from OpenAI");
      }

      // Apply token limits if necessary
      const limitedResponse = this.applyTokenLimit(
        textResponse,
        finalConfig.maxTokens!,
      );

      // Estimate tokens for logging
      const estimatedTokens = this.estimateTokens(limitedResponse);

      // Log usage for monitoring
      this.logUsage(sanitizedPrompt, limitedResponse, estimatedTokens);

      return limitedResponse;
    } catch (error) {
      // Extract error information
      const errorInfo = this.extractErrorInfo(error);

      // Throw a more descriptive error
      throw new Error(
        `OpenAI API error: ${errorInfo.message}${errorInfo.code ? ` (Code: ${errorInfo.code})` : ""}`,
      );
    }
  }

  // Health check specific to OpenAI
  async healthCheck(): Promise<boolean> {
    try {
      // Try to generate a very simple response
      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Respond with just 'OK'" }],
        max_tokens: 5,
      });

      // Check if we got a valid response
      return response.choices[0]?.message?.content ? true : false;
    } catch (error) {
      return false; // Health check failed
    }
  }

  // Validate OpenAI-specific configuration
  protected validateConfig(): void {
    // Call parent validation
    super.validateConfig();

    // OpenAI-specific validations
    if (this.config.provider !== "openai") {
      throw new Error('Provider must be "openai" for OpenAIAdapter');
    }

    // Validate API key format (OpenAI keys start with 'sk-')
    if (this.config.apiKey && !this.isValidOpenAIApiKey(this.config.apiKey)) {
      throw new Error("Invalid OpenAI API key format");
    }

    // Validate model name
    if (this.config.model && !this.isValidOpenAIModel(this.config.model)) {
      throw new Error(
        `Invalid OpenAI model: ${this.config.model}. Valid models: gpt-3.5-turbo, gpt-4, gpt-4-turbo, etc.`,
      );
    }
  }

  // Get OpenAI-specific default configuration
  protected getDefaultConfig(): Partial<ModelConfig> {
    return {
      ...super.getDefaultConfig(), // Get parent defaults
      temperature: 0.7, // Default temperature for OpenAI
      maxTokens: 1000, // Default max tokens
    };
  }

  // Check if API key format is valid for OpenAI
  private isValidOpenAIApiKey(apiKey: string): boolean {
    // OpenAI API keys start with 'sk-' and are followed by alphanumeric characters
    return (
      typeof apiKey === "string" &&
      apiKey.startsWith("sk-") &&
      apiKey.length > 20
    );
  }

  // Check if model name is valid for OpenAI
  private isValidOpenAIModel(model: string): boolean {
    const validModels = [
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-16k",
      "gpt-4",
      "gpt-4-turbo",
      "gpt-4-turbo-preview",
      "gpt-4o",
      "gpt-4o-mini",
    ];

    return validModels.includes(model) || model.startsWith("gpt-"); // Allow any model starting with 'gpt-'
  }

  // Extract error information specific to OpenAI
  protected extractErrorInfo(error: any): { message: string; code?: string } {
    // Try to get OpenAI-specific error information
    if (error && typeof error === "object") {
      // Check for OpenAI API error structure
      if (error.status && error.status.code && error.status.message) {
        return {
          message: error.status.message,
          code: String(error.status.code),
        };
      }

      // Check for response errors
      if (error.response && error.response.data) {
        const data = error.response.data;
        return {
          message: data.error?.message || data.message || "OpenAI API error",
          code: data.error?.code || data.code,
        };
      }

      // Check for OpenAI error format
      if (error.message) {
        return {
          message: error.message,
          code: error.code,
        };
      }
    }

    // Fall back to parent error extraction
    return super.extractErrorInfo(error);
  }

  // Get model capabilities and information
  async getModelInfo(): Promise<{
    name: string;
    provider: string;
    maxTokens: number;
    supportedFeatures: string[];
  }> {
    return {
      name: this.config.model || "gpt-3.5-turbo",
      provider: "openai",
      maxTokens: 4096, // OpenAI's typical max output tokens for gpt-3.5-turbo
      supportedFeatures: [
        "text-generation",
        "conversation",
        "temperature-control",
        "token-limiting",
        "function-calling",
      ],
    };
  }

  // Test the connection with a simple request
  async testConnection(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Send a simple test request
      const testPrompt = "Hello";
      await this.generateResponse(testPrompt, this.config);

      const latency = Date.now() - startTime;

      return { success: true, latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        latency,
        error: errorMessage,
      };
    }
  }
}
