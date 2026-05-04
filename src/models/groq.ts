import { Groq } from "groq-sdk"; // Import Groq SDK
import { BaseModelAdapter } from "./base"; // Import base adapter
import { ModelConfig } from "../types"; // Import ModelConfig type

// Groq model adapter implementation
export class GroqAdapter extends BaseModelAdapter {
  private groq: Groq; // Groq client

  constructor(config: ModelConfig) {
    super(config); // Call parent constructor

    // Validate configuration
    this.validateConfig();

    // Initialize Groq client
    if (!this.config.apiKey) {
      throw new Error("API key is required for Groq adapter");
    }
    this.groq = new Groq({ apiKey: this.config.apiKey });
  }

  // Generate response using Groq API
  async generateResponse(prompt: string, config: ModelConfig): Promise<string> {
    try {
      // Sanitize and validate the prompt
      const sanitizedPrompt = this.sanitizePrompt(prompt);

      // Merge configuration with defaults
      const finalConfig = this.mergeConfig(config);

      // Generate completion with Groq
      const response = await this.groq.chat.completions.create({
        model: this.config.model,
        messages: [{ role: "user", content: sanitizedPrompt }],
        temperature: finalConfig.temperature ?? null,
        max_tokens: finalConfig.maxTokens ?? null,
      });

      // Extract the text response
      const textResponse = response.choices[0]?.message?.content;

      if (!textResponse) {
        throw new Error("No response received from Groq");
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
        `Groq API error: ${errorInfo.message}${errorInfo.code ? ` (Code: ${errorInfo.code})` : ""}`,
      );
    }
  }

  // Health check specific to Groq
  async healthCheck(): Promise<boolean> {
    try {
      // Try to generate a very simple response
      const response = await this.groq.chat.completions.create({
        model: this.config.model || "llama3-8b-8192",
        messages: [{ role: "user", content: "Respond with just 'OK'" }],
        max_tokens: 5,
      });

      // Check if we got a valid response
      return response.choices[0]?.message?.content ? true : false;
    } catch (error) {
      return false; // Health check failed
    }
  }

  // Validate Groq-specific configuration
  protected validateConfig(): void {
    // Call parent validation
    super.validateConfig();

    // Groq-specific validations
    if (this.config.provider !== "groq") {
      throw new Error('Provider must be "groq" for GroqAdapter');
    }

    // Validate API key format (Groq keys are long alphanumeric strings)
    if (this.config.apiKey && !this.isValidGroqApiKey(this.config.apiKey)) {
      throw new Error("Invalid Groq API key format");
    }

    // Validate model name
    if (this.config.model && !this.isValidGroqModel(this.config.model)) {
      throw new Error(
        `Invalid Groq model: ${this.config.model}. Valid models: llama3-8b-8192, llama3-70b-8192, mixtral-8x7b-32768, etc.`,
      );
    }
  }

  // Get Groq-specific default configuration
  protected getDefaultConfig(): Partial<ModelConfig> {
    return {
      ...super.getDefaultConfig(), // Get parent defaults
      temperature: 0.7, // Default temperature for Groq
      maxTokens: 2048, // Default max tokens
    };
  }

  // Check if API key format is valid for Groq
  private isValidGroqApiKey(apiKey: string): boolean {
    // Groq API keys are long alphanumeric strings starting with 'gsk_'
    return (
      typeof apiKey === "string" &&
      apiKey.startsWith("gsk_") &&
      apiKey.length > 20
    );
  }

  // Check if model name is valid for Groq
  private isValidGroqModel(model: string): boolean {
    const validModels = [
      "llama3-8b-8192",
      "llama3-70b-8192",
      "llama3-1b-8192",
      "mixtral-8x7b-32768",
      "gemma-7b-it",
    ];

    return validModels.includes(model);
  }

  // Extract error information specific to Groq
  protected extractErrorInfo(error: any): { message: string; code?: string } {
    // Try to get Groq-specific error information
    if (error && typeof error === "object") {
      // Check for Groq API error structure
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
          message: data.error?.message || data.message || "Groq API error",
          code: data.error?.code || data.code,
        };
      }

      // Check for Groq error format
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
      name: this.config.model || "llama3-8b-8192",
      provider: "groq",
      maxTokens: 8192, // Groq's max output tokens
      supportedFeatures: [
        "text-generation",
        "conversation",
        "temperature-control",
        "token-limiting",
        "fast-inference",
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
